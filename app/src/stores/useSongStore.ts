// src/stores/useSongStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { SongData } from '@/interfaces';
import { LyricLine, WhisperXOutput } from '@/interfaces/lyrics';
import { db, SongRecord, WordRecord, base64ToBlob } from '@/lib/db';
import useSettingsStore from './useSettingsStore';
import { processWhisperXOutput } from '@/utils/lyricsProcessor';
import KuroshiroManager from '@/lib/kuroshiro';

interface SongState {
  song: SongData | null;
  lyrics: LyricLine[] | null;
  previewLyrics: LyricLine[] | null;
  whisperData: WhisperXOutput | null;
  isLoading: boolean;
  error: string | null;
  fetchSong: (url: string) => Promise<void>;
  loadSongById: (id: number) => Promise<void>;
  fetchAllSongs: () => Promise<SongData[]>;
  generateTranscriptionPreview: (song: SongData, t: (key: string) => string) => Promise<void>;
  setProcessedLyrics: (lyrics: LyricLine[]) => void;
  updateLyricLine: (index: number, updatedLine: LyricLine) => void;
  updateSongInfo: (info: { title: string; artist: string }) => void;
  setPreviewLyrics: (lyrics: LyricLine[]) => void;
  clearPreviewLyrics: () => void;
  commitPreviewLyrics: () => void;
  cacheCurrentSongAudio: () => Promise<void>;
  updateLyricTranslations: (newTranslatedLyrics: { index: number; translation: string }[]) => Promise<void>;
  deleteSongs: (songIds: number[]) => Promise<void>;
  // New granular import methods
  addManySongs: (songs: SongRecord[], words: WordRecord[]) => Promise<void>;
  overwriteSong: (existingSongId: number, importedSong: SongRecord, importedWords: WordRecord[]) => Promise<void>;
  mergeWordsIntoSong: (existingSongId: number, importedWords: WordRecord[]) => Promise<void>;
  clearAllTimestamps: () => void;
  updateLineTime: (lineIndex: number, timeType: 'start' | 'end', time: number) => void;
}

const useSongStore = create<SongState>()(
  immer((set, get) => ({
    song: null,
    lyrics: null,
    previewLyrics: null,
    whisperData: null,
    isLoading: false,
    error: null,
    fetchSong: async (url) => {
        set({ isLoading: true, error: null, song: null, lyrics: null, whisperData: null });
        const { settings } = useSettingsStore.getState();
        const BACKEND_URL = settings.backendUrl;

        try {
            const existingSong = await db.songs.where('sourceUrl').equals(url).first();

            // If song already exists in the database, just load it with the robust loader.
            if (existingSong && existingSong.id) {
                await get().loadSongById(existingSong.id);
                // loadSongById will handle the rest of the state updates.
                return;
            }

            // If it's a new song, fetch its info, create a DB entry, then use the robust loader.
            const mediaResponse = await fetch(`${BACKEND_URL}/api/media/fetch?url=${encodeURIComponent(url)}`);
            if (!mediaResponse.ok) {
                const errorDetail = (await mediaResponse.json()).detail || 'Failed to fetch media from backend';
                throw new Error(errorDetail);
            }
            
            const songData: Omit<SongData, 'sourceUrl'> & {cover_url?: string} = await mediaResponse.json();
            
            // Fetch cover image and create a blob for it to be stored
            let coverImageBlob: Blob | undefined;
            if (songData.cover_url) {
                try {
                    const proxiedCoverUrl = `${BACKEND_URL}/api/media/proxy-image?url=${encodeURIComponent(songData.cover_url)}`;
                    const coverResponse = await fetch(proxiedCoverUrl);
                    if(coverResponse.ok) {
                        coverImageBlob = await coverResponse.blob();
                    }
                } catch (coverError) {
                    console.warn('Failed to fetch or process cover image:', coverError);
                    // Continue without a cover if it fails
                }
            }
            
            // Create the record in the local database
            const recordToSave: SongRecord = {
              ...(songData as SongData),
              media_url: songData.media_url, // This is the relative path
              sourceUrl: url,
              lyrics: [],
              createdAt: new Date(),
              coverImageData: coverImageBlob,
              is_cached: false, // Not locally cached yet
            };
            const newId = await db.songs.add(recordToSave);
            
            // Now that the song is in our database, call the robust loader to handle playback.
            await get().loadSongById(newId as number);

        } catch (err) {
            set({ error: (err as Error).message, isLoading: false, song: null, lyrics: null });
            // No return value to signify failure, the UI should react to the error state.
        }
    },
    loadSongById: async (id: number) => {
        const { song } = get();
        if (song && song.id === id) {
          set({ isLoading: false, error: null });
          return;
        }
        set({ isLoading: true, error: null, song: null, lyrics: null, whisperData: null });
        const { settings } = useSettingsStore.getState();
        const BACKEND_URL = settings.backendUrl;
  
        try {
          const songFromDb = await db.songs.get(id);
          if (!songFromDb) throw new Error(`Song with ID ${id} not found.`);
  
          // Path 1: Fully cached locally in browser
          if (songFromDb.audioData) {
            const mediaUrlForPlayback = URL.createObjectURL(songFromDb.audioData);
            let coverUrlForDisplay = songFromDb.cover_url;
            if (songFromDb.coverImageData) {
                coverUrlForDisplay = URL.createObjectURL(songFromDb.coverImageData);
            }
            const songForState = { ...songFromDb, media_url: mediaUrlForPlayback, cover_url: coverUrlForDisplay };
            set({ song: songForState, lyrics: songFromDb.lyrics, isLoading: false });
            return;
          }

          // Path 2: Relying on backend cache. Verify it exists.
          const backendMediaUrl = `${BACKEND_URL}${songFromDb.media_url}`;
          const headResponse = await fetch(backendMediaUrl, { method: 'HEAD' });

          let finalSongRecord = songFromDb;

          // If backend cache is missing, re-fetch it
          if (headResponse.status === 404) {
            console.warn(`Backend cache missing for ${songFromDb.title}. Re-fetching...`);
            const reFetchResponse = await fetch(`${BACKEND_URL}/api/media/fetch?url=${encodeURIComponent(songFromDb.sourceUrl)}`);
            
            if (!reFetchResponse.ok) {
                const errorDetail = (await reFetchResponse.json()).detail || 'Failed to re-cache song on backend.';
                throw new Error(errorDetail);
            }

            const newMediaInfo = await reFetchResponse.json();
            const updatePayload = {
                media_url: newMediaInfo.media_url,
                local_path: newMediaInfo.local_path,
                duration: newMediaInfo.duration,
                title: newMediaInfo.title,
                artist: newMediaInfo.artist,
            };

            await db.songs.update(id, updatePayload);
            finalSongRecord = { ...songFromDb, ...updatePayload }; // Use updated info for this session
          } else if (!headResponse.ok) {
            throw new Error(`Backend cache check failed for ${songFromDb.title} with status: ${headResponse.status}`);
          }

          // Proceed with verified or re-cached data
          let mediaUrlForPlayback = `${BACKEND_URL}${finalSongRecord.media_url}`;
          let coverUrlForDisplay = finalSongRecord.cover_url;
          if (finalSongRecord.coverImageData) {
            coverUrlForDisplay = URL.createObjectURL(finalSongRecord.coverImageData);
          }
  
          const songForState = { ...finalSongRecord, media_url: mediaUrlForPlayback, cover_url: coverUrlForDisplay };
          set({ song: songForState, lyrics: finalSongRecord.lyrics, isLoading: false });

        } catch (err) {
          set({ error: (err as Error).message, isLoading: false, song: null, lyrics: null });
        }
    },
    fetchAllSongs: async () => {
        set({ isLoading: true, error: null });
        const { settings } = useSettingsStore.getState();
        const BACKEND_URL = settings.backendUrl;
        try {
          const allSongs = await db.songs.toArray();
          const processedSongs = allSongs.map(s => {
            let mediaUrl = `${BACKEND_URL}${s.media_url}`;
            if (s.audioData) mediaUrl = URL.createObjectURL(s.audioData);
            let coverUrl = s.cover_url;
            if (s.coverImageData) coverUrl = URL.createObjectURL(s.coverImageData);
            return { ...s, media_url: mediaUrl, cover_url: coverUrl };
          });
          set({ isLoading: false });
          return processedSongs;
        } catch (err) {
          set({ error: (err as Error).message, isLoading: false });
          return [];
        }
    },
    generateTranscriptionPreview: async (song, t) => {
        set({ isLoading: true, error: null });
        const { settings } = useSettingsStore.getState();
        const BACKEND_URL = settings.backendUrl;
        const mediaId = song.id!.toString();
        try {
          const songRecord = await db.songs.get(song.id!);
          if (!songRecord) throw new Error("Song not found in DB for transcription.");
  
          // Check status first
          const statusUrl = new URL(`${BACKEND_URL}/api/transcribe/status/${mediaId}`);
          statusUrl.searchParams.append('local_path', songRecord.local_path);
          let statusResponse = await fetch(statusUrl.toString());
          if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              if (statusData.status === 'completed') {
                  const useCache = window.confirm(t('transcription.cacheFoundConfirm'));
                  if (useCache) {
                      const kuroshiro = await KuroshiroManager.getInstance();
                      const tempLyrics = await processWhisperXOutput(statusData.data, kuroshiro);
                      set({ previewLyrics: tempLyrics, isLoading: false });
                      return;
                  } else {
                      // Force re-transcribe
                      const newTranscriptionResponse = await fetch(`${BACKEND_URL}/api/transcribe`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                              local_path: songRecord.local_path, 
                              media_id: mediaId, 
                              display_name: song.title,
                              force_retranscribe: true 
                          }),
                      });
                      const newData = await newTranscriptionResponse.json();
                      set({ isLoading: false });
                      alert(t('transcription.startedAlert').replace('{{queue_position}}', newData.queue_position));
                      return;
                  }
              } else if (statusData.status === 'running' || statusData.status === 'pending' || statusData.status === 'processing') {
                  set({ isLoading: false });
                  alert(t('transcription.inProgressAlert').replace('{{queue_position}}', statusData.queue_position));
                  return;
              }
          }

          // Start a new one
          const transcribeResponse = await fetch(`${BACKEND_URL}/api/transcribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  local_path: songRecord.local_path, 
                  media_id: mediaId, 
                  display_name: song.title,
                  force_retranscribe: false 
              }),
          });
          
          if (!transcribeResponse.ok) throw new Error((await transcribeResponse.json()).detail || t('transcription.failedStartError'));
          
          const startData = await transcribeResponse.json();
          if (startData.status === 'cached' || startData.status === 'completed') {
              // Edge case: it finished instantly or was cached right as we asked
              const verifyUrl = new URL(`${BACKEND_URL}/api/transcribe/status/${mediaId}`);
              verifyUrl.searchParams.append('local_path', songRecord.local_path);
              statusResponse = await fetch(verifyUrl.toString());
              const statusData = await statusResponse.json();
              const kuroshiro = await KuroshiroManager.getInstance();
              const tempLyrics = await processWhisperXOutput(statusData.data, kuroshiro);
              set({ previewLyrics: tempLyrics, isLoading: false });
          } else {
              set({ isLoading: false });
              alert(t('transcription.startedAlert').replace('{{queue_position}}', startData.queue_position));
          }
        } catch (err) {
          set({ error: (err as Error).message, isLoading: false });
        }
    },
    setProcessedLyrics: (processedLyrics) => {
        const { song } = get();
        if (!song?.id) return;
        db.songs.update(song.id, { lyrics: processedLyrics });
        set({ lyrics: processedLyrics });
    },
    updateLyricLine: (index, updatedLine) => {
        const { lyrics, song } = get();
        if (!lyrics || !song?.id) return;
        const newLyrics = [...lyrics];
        newLyrics[index] = updatedLine;
        db.songs.update(song.id, { lyrics: newLyrics });
        set({ lyrics: newLyrics });
    },
    updateSongInfo: (info) => {
        const { song } = get();
        if (song) {
          const updatedSong = { ...song, ...info };
          if (song.id) db.songs.update(song.id, info);
          set({ song: updatedSong });
        }
    },
    setPreviewLyrics: (lyrics) => set({ previewLyrics: lyrics }),
    clearPreviewLyrics: () => set({ previewLyrics: null }),
    commitPreviewLyrics: () => {
        const { song, previewLyrics } = get();
        if (previewLyrics && song?.id) {
          db.songs.update(song.id, { lyrics: previewLyrics });
          set({ lyrics: previewLyrics, previewLyrics: null });
        }
    },
    cacheCurrentSongAudio: async () => {
        const { song } = get();
        if (!song || song.is_cached || !song.id) return;
        try {
            const songRecord = await db.songs.get(song.id);
            if (!songRecord) throw new Error("Song record not found in DB.");
            const { settings } = useSettingsStore.getState();
            const audioUrlToFetch = `${settings.backendUrl}${songRecord.media_url}`;
            const audioResponse = await fetch(audioUrlToFetch);
            if (!audioResponse.ok) throw new Error('Failed to download audio.');
            const audioBlob = await audioResponse.blob();
            await db.songs.update(song.id, { audioData: audioBlob, is_cached: true });
            const objectUrl = URL.createObjectURL(audioBlob);
            set(state => {
              if (state.song) {
                state.song.is_cached = true;
                state.song.media_url = objectUrl;
              }
            });
            alert(`Successfully cached audio for "${song.title}"`);
        } catch (err) {
            console.error("Failed to cache audio:", err);
            alert("Failed to cache audio.");
        }
    },
    updateLyricTranslations: async (newTranslatedLyrics) => {
        const { song, lyrics } = get();
        if (!song?.id || !lyrics) return;
        const updatedLyrics = lyrics.map((line, index) => {
            const match = newTranslatedLyrics.find(t => t.index === index);
            return match ? { ...line, translation: match.translation } : line;
        });
        await db.songs.update(song.id, { lyrics: updatedLyrics });
        set({ lyrics: updatedLyrics });
    },
    clearAllTimestamps: () => {
        const { song, lyrics } = get();
        if (!song?.id || !lyrics) return;
        const newLyrics = lyrics.map(line => ({
            ...line,
            startTime: 0,
            endTime: 0,
            tokens: line.tokens.map(t => ({ ...t, startTime: 0, endTime: 0 }))
        }));
        db.songs.update(song.id, { lyrics: newLyrics });
        set({ lyrics: newLyrics });
    },
    updateLineTime: (lineIndex, timeType, time) => {
        set(state => {
            const lyrics = state.lyrics;
            if (!lyrics) return;

            if (lineIndex < 0 || lineIndex >= lyrics.length) return;

            if (timeType === 'start') {
                lyrics[lineIndex].startTime = time;
                
                // Requirement: If previous line's end time is 0 or overlaps with new start, fix it.
                for (let i = lineIndex - 1; i >= 0; i--) {
                    if (lyrics[i].startTime > 0) {
                        const newEnd = Math.max(lyrics[i].startTime + 0.05, time - 0.1);
                        if (lyrics[i].endTime === 0 || lyrics[i].endTime > time) {
                            lyrics[i].endTime = newEnd;
                        }
                        break;
                    }
                }
            } else {
                lyrics[lineIndex].endTime = time;
            }

            // Recalculate timings for all lines. 
            for (let i = 0; i < lyrics.length; i++) {
                const line = lyrics[i];
                if (line.startTime === 0) continue; // Unset line

                let effectiveStart = line.startTime;
                let effectiveEnd = line.endTime;

                // If end time is missing or invalid, infer it.
                if (effectiveEnd <= effectiveStart) {
                    let nextValidStart = -1;
                    for (let j = i + 1; j < lyrics.length; j++) {
                        if (lyrics[j].startTime > effectiveStart) {
                            nextValidStart = lyrics[j].startTime;
                            break;
                        }
                    }
                    
                    if (nextValidStart !== -1) {
                        // Infer from next line with 0.1s gap
                        effectiveEnd = Math.max(effectiveStart + 0.05, nextValidStart - 0.1);
                    } else {
                        // Requirement: Default to song duration if no next line
                        effectiveEnd = state.song?.duration && state.song.duration > effectiveStart 
                            ? state.song.duration 
                            : effectiveStart + 2;
                    }
                    
                    // Save inferred end time back to the line
                    line.endTime = effectiveEnd;
                }

                // Distribute time across tokens based on character length
                const totalChars = line.tokens.reduce((sum, t) => sum + t.surface.length, 0);
                let currentTokenTime = effectiveStart;

                line.tokens.forEach(token => {
                    const charRatio = totalChars > 0 ? token.surface.length / totalChars : 0;
                    const duration = (effectiveEnd - effectiveStart) * charRatio;
                    token.startTime = currentTokenTime;
                    token.endTime = currentTokenTime + duration;
                    currentTokenTime = token.endTime;
                });
            }

            // In Zustand with Immer, state is a Proxy draft. We must convert it back to a plain object before sending it to IndexedDB to avoid DataCloneError or silent drops.
            if (state.song?.id) {
                // JSON stringify/parse is a safe way to strip Immer proxies
                const rawLyrics = JSON.parse(JSON.stringify(state.lyrics));
                db.songs.update(state.song.id, { lyrics: rawLyrics }).catch(err => {
                    console.error("Failed to save lyrics to DB:", err);
                });
            }
        });
    },
    deleteSongs: async (songIds) => {
        await db.words.where('sourceSongId').anyOf(songIds).delete();
        await db.songs.bulkDelete(songIds);
    },
    addManySongs: async (songs, words) => {
      const idMapping: { [oldId: number]: number } = {};
      for (const song of songs) {
          const oldId = song.id;
          delete song.id;
          if (song.coverImageData && typeof song.coverImageData === 'string') {
              song.coverImageData = await base64ToBlob(song.coverImageData as unknown as string);
          }
          const newId = await db.songs.add(song);
          if (oldId !== undefined) {
              idMapping[oldId] = newId as number;
          }
      }

      const wordsToAdd = words.map(word => {
          const newSongId = idMapping[word.sourceSongId];
          if (newSongId !== undefined) {
              delete word.id;
              word.sourceSongId = newSongId;
              return word;
          }
          return null;
      }).filter((w): w is WordRecord => w !== null);
      
      if (wordsToAdd.length > 0) {
        await db.words.bulkAdd(wordsToAdd);
      }
    },
    overwriteSong: async (existingSongId, importedSong, importedWords) => {
      // 1. Delete existing words and song
      await db.words.where('sourceSongId').equals(existingSongId).delete();
      await db.songs.delete(existingSongId);

      // 2. Add the new song
      delete importedSong.id;
      if (importedSong.coverImageData && typeof importedSong.coverImageData === 'string') {
        importedSong.coverImageData = await base64ToBlob(importedSong.coverImageData as unknown as string);
      }
      const newId = await db.songs.add(importedSong);

      // 3. Add new words with the new song ID
      const wordsToAdd = importedWords.map(word => {
          delete word.id;
          word.sourceSongId = newId as number;
          return word;
      });
      if (wordsToAdd.length > 0) {
        await db.words.bulkAdd(wordsToAdd);
      }
    },
    mergeWordsIntoSong: async (existingSongId, importedWords) => {
      const wordsToAdd: WordRecord[] = [];
      for (const word of importedWords) {
        const existingWord = await db.words.where({ surface: word.surface, sourceSongId: existingSongId }).first();
        if (!existingWord) {
            delete word.id;
            word.sourceSongId = existingSongId;
            wordsToAdd.push(word);
        }
      }
      if (wordsToAdd.length > 0) {
        await db.words.bulkAdd(wordsToAdd);
      }
    },
  }))
);

export default useSongStore;
