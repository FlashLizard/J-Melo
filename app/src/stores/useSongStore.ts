// src/stores/useSongStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { LyricLine } from '@/interfaces/lyrics';
import { WhisperXOutput } from '@/hooks/useLyricsProcessor';
import { db, SongRecord, base64ToBlob } from '@/lib/db';
import useSettingsStore from './useSettingsStore'; // Import useSettingsStore

export interface SongData {
  id?: number;
  media_type: 'video' | 'audio';
  title: string;
  artist: string | null;
  cover_url?: string | null;
  duration: number;
  media_url: string; 
  local_path: string; 
  sourceUrl: string;
  is_cached?: boolean; // is_cached is now a property of SongData, directly reflecting the DB status
}

interface SongState {
  song: SongData | null;
  lyrics: LyricLine[] | null;
  previewLyrics: LyricLine[] | null;
  whisperData: WhisperXOutput | null;
  isLoading: boolean;
  error: string | null;
  
  fetchSong: (url: string) => Promise<SongData | undefined>;
  loadSongById: (id: number) => Promise<void>; // New action to load song by ID
  fetchAllSongs: () => Promise<SongData[]>; // New action to fetch all songs
  setProcessedLyrics: (lyrics: LyricLine[]) => void;
  updateLyricLine: (updatedLine: LyricLine) => void;
  updateSongInfo: (info: { title: string; artist: string }) => void;
  setPreviewLyrics: (lyrics: LyricLine[]) => void;
  clearPreviewLyrics: () => void;
  commitPreviewLyrics: () => void;
  cacheCurrentSongAudio: () => Promise<void>;
  updateLyricTranslations: (newTranslatedLyrics: LyricLine[]) => Promise<void>;
  deleteSongs: (songIds: number[]) => Promise<void>;
  importSongs: (songsData: any[]) => Promise<void>;
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
      const { settings } = useSettingsStore.getState(); // Get current settings
      const BACKEND_URL = settings.backendUrl;
      try {
        const existingSong = await db.songs.where('sourceUrl').equals(url).first();
        
        if (existingSong) {
            let mediaUrlForPlayback = `${BACKEND_URL}${existingSong.media_url}`;
            if (existingSong.audioData) {
                mediaUrlForPlayback = URL.createObjectURL(existingSong.audioData);
            }
            let coverUrlForDisplay = existingSong.cover_url;
            if(existingSong.coverImageData) {
                coverUrlForDisplay = URL.createObjectURL(existingSong.coverImageData);
            }

            const songForState = { ...existingSong, media_url: mediaUrlForPlayback, cover_url: coverUrlForDisplay, is_cached: existingSong.is_cached };
            set({ song: songForState, lyrics: existingSong.lyrics, isLoading: false });
            return songForState;
        }

        const mediaResponse = await fetch(`${BACKEND_URL}/api/media/fetch?url=${encodeURIComponent(url)}`);
        if (!mediaResponse.ok) throw new Error((await mediaResponse.json()).detail || 'Failed to fetch media');
        
        let songData: Omit<SongData, 'sourceUrl'> & {cover_url?: string} = await mediaResponse.json();
        
        let coverImageBlob: Blob | undefined;
        if (songData.cover_url) {
            const proxiedCoverUrl = `${BACKEND_URL}/api/media/proxy-image?url=${encodeURIComponent(songData.cover_url)}`;
            const coverResponse = await fetch(proxiedCoverUrl);
            if(coverResponse.ok) {
                coverImageBlob = await coverResponse.blob();
                songData.cover_url = URL.createObjectURL(coverImageBlob);
            } else {
                songData.cover_url = 'https://via.placeholder.com/300';
            }
        }
        
        const mediaUrlForPlayback = `${BACKEND_URL}${songData.media_url}`;
        const songDataWithSource: SongData = { ...songData, media_url: mediaUrlForPlayback, sourceUrl: url, is_cached: false }; // New songs are not cached initially
        
        const transcribeResponse = await fetch(`${BACKEND_URL}/api/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_path: songData.local_path }),
        });
        if (!transcribeResponse.ok) throw new Error((await transcribeResponse.json()).detail || 'Failed to transcribe audio');
        const whisperData: WhisperXOutput = await transcribeResponse.json();
        
        const recordToSave: SongRecord = {
          ...(songData as SongData),
          media_url: songData.media_url, // Save relative path
          sourceUrl: url,
          lyrics: [],
          createdAt: new Date(),
          coverImageData: coverImageBlob,
          is_cached: false, // Initial state in DB
        };
        const id = await db.songs.add(recordToSave);
        
        const newlyAddedSong = { ...songDataWithSource, id };
        set({ song: newlyAddedSong, whisperData: whisperData, isLoading: false });
        return newlyAddedSong;

      } catch (err) {
        set({ error: (err as Error).message, isLoading: false, song: null, lyrics: null });
        return undefined;
      }
    },

    loadSongById: async (id: number) => {
      const { song } = get();
      if (song && song.id === id) { // If already loading/loaded the same song, do nothing
        set({ isLoading: false, error: null }); // Ensure loading state is false if already loaded
        return;
      }
      set({ isLoading: true, error: null, song: null, lyrics: null, whisperData: null });
      const { settings } = useSettingsStore.getState();
      const BACKEND_URL = settings.backendUrl;

      try {
        const existingSong = await db.songs.get(id);
        if (!existingSong) throw new Error(`Song with ID ${id} not found.`);

        let mediaUrlForPlayback = `${BACKEND_URL}${existingSong.media_url}`;
        if (existingSong.audioData) {
          mediaUrlForPlayback = URL.createObjectURL(existingSong.audioData);
        }
        let coverUrlForDisplay = existingSong.cover_url;
        if (existingSong.coverImageData) {
          coverUrlForDisplay = URL.createObjectURL(existingSong.coverImageData);
        }

        const songForState = { ...existingSong, media_url: mediaUrlForPlayback, cover_url: coverUrlForDisplay, is_cached: existingSong.is_cached };
        set({ song: songForState, lyrics: existingSong.lyrics, isLoading: false });
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
        const processedSongs = allSongs.map(song => {
          let mediaUrlForPlayback = `${BACKEND_URL}${song.media_url}`;
          if (song.audioData) {
              mediaUrlForPlayback = URL.createObjectURL(song.audioData);
          }
          let coverUrlForDisplay = song.cover_url;
          if(song.coverImageData) {
              coverUrlForDisplay = URL.createObjectURL(song.coverImageData);
          }
          return { ...song, media_url: mediaUrlForPlayback, cover_url: coverUrlForDisplay };
        });
        set({ isLoading: false });
        return processedSongs;
      } catch (err) {
        set({ error: (err as Error).message, isLoading: false });
        return [];
      }
    },

    cacheCurrentSongAudio: async () => {
        const { song } = get();
        if (!song || song.is_cached || !song.id) return;
  
        try {
          const songRecord = await db.songs.get(song.id);
          if (!songRecord) throw new Error("Song record not found in DB for caching.");
          
          const { settings } = useSettingsStore.getState(); // Get current settings
          const BACKEND_URL = settings.backendUrl;
          const audioUrlToFetch = `${BACKEND_URL}${songRecord.media_url}`;
          const audioResponse = await fetch(audioUrlToFetch);
          if (!audioResponse.ok) throw new Error('Failed to download audio blob for caching.');
          const audioBlob = await audioResponse.blob();
          
          await db.songs.update(song.id, { audioData: audioBlob, is_cached: true }); // Update is_cached in DB
          
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

    setProcessedLyrics: (processedLyrics) => {
        const { song } = get();
        if (!song?.id) return;
        db.songs.update(song.id, { lyrics: processedLyrics });
        set({ lyrics: processedLyrics });
    },
    
    updateLyricLine: (updatedLine) => {
        const { lyrics, song } = get();
        if (!lyrics || !song?.id) return;
        
        const newLyrics = lyrics.map(line => 
          (line as any).id === (updatedLine as any).id ? updatedLine : line
        );
        
        db.songs.update(song.id, { lyrics: newLyrics });
        set({ lyrics: newLyrics });
    },

    updateSongInfo: (info) => {
        const { song } = get();
        if (song) {
          const updatedSong = { ...song, ...info };
          if (song.id) {
            db.songs.update(song.id, info);
          }
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
        } else if (previewLyrics) {
          set({ lyrics: previewLyrics, previewLyrics: null });
        }
    },

    updateLyricTranslations: async (newTranslatedLyrics: LyricLine[]) => {
      const { song, lyrics } = get();
      if (!song?.id || !lyrics) return;

      const updatedLyrics = lyrics.map(existingLine => {
        const matchingTranslation = newTranslatedLyrics.find(
          translatedLine => existingLine.id === translatedLine.id
        );
        if (matchingTranslation && matchingTranslation.translation !== undefined) {
          return { ...existingLine, translation: matchingTranslation.translation };
        }
        return existingLine;
      });

      await db.songs.update(song.id, { lyrics: updatedLyrics });
      set({ lyrics: updatedLyrics });
    },

    deleteSongs: async (songIds: number[]) => {
        await db.words.where('sourceSongId').anyOf(songIds).delete();
        await db.songs.bulkDelete(songIds);
    },

    importSongs: async (songsData: any[]) => {
        for (const song of songsData) {
          const existing = await db.songs.where('sourceUrl').equals(song.sourceUrl).first();
          if (!existing) {
            if (song.coverImageData) {
              song.coverImageData = await base64ToBlob(song.coverImageData);
            }
            await db.songs.add(song);
          }
        }
    },
  }))
);

export default useSongStore;