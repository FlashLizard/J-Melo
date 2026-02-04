// src/stores/useSongStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { LyricLine } from '@/interfaces/lyrics';
import { WhisperXOutput } from '@/hooks/useLyricsProcessor';
import { db, SongRecord } from '@/lib/db';

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
  
  fetchSong: (url: string) => Promise<void>;
  setProcessedLyrics: (lyrics: LyricLine[]) => void;
  updateLyricLine: (updatedLine: LyricLine) => void;
  updateSongInfo: (info: { title: string; artist: string }) => void;
  setPreviewLyrics: (lyrics: LyricLine[]) => void;
  clearPreviewLyrics: () => void;
  commitPreviewLyrics: () => void;
  cacheCurrentSongAudio: () => Promise<void>;
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
      const BACKEND_URL = 'http://localhost:8000';
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
            return;
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
          proficiency: 0,
          coverImageData: coverImageBlob,
          is_cached: false, // Initial state in DB
        };
        const id = await db.songs.add(recordToSave);
        
        set({ song: { ...songDataWithSource, id }, whisperData: whisperData, isLoading: false });

      } catch (err) {
        set({ error: (err as Error).message, isLoading: false, song: null, lyrics: null });
      }
    },

    cacheCurrentSongAudio: async () => {
        const { song } = get();
        if (!song || song.is_cached || !song.id) return;
  
        try {
          const songRecord = await db.songs.get(song.id);
          if (!songRecord) throw new Error("Song record not found in DB for caching.");
          
          const audioUrlToFetch = `http://localhost:8000${songRecord.media_url}`;
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
  }))
);

export default useSongStore;