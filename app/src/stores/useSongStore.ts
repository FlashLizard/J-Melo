// src/stores/useSongStore.ts
import { create } from 'zustand';
import { LyricLine } from '@/lib/mock-data';
import { WhisperXOutput } from '@/hooks/useLyricsProcessor';
import { db, SongRecord } from '@/lib/db';

// This matches the backend's MediaFetchResponse model
export interface SongData {
  media_type: 'video' | 'audio';
  title: string;
  artist: string | null;
  cover_url: string | null;
  duration: number;
  media_url: string;
  local_path: string; // Add local_path to be used for transcription
}

interface SongState {
  song: SongData | null;
  lyrics: LyricLine[] | null;
  isLoading: boolean;
  error: string | null;
  actions: {
    fetchSong: (url: string, lyricsProcessor: (data: WhisperXOutput) => Promise<LyricLine[]>) => Promise<void>;
  };
}

const useSongStore = create<SongState>((set) => ({
  song: null,
  lyrics: null,
  isLoading: false,
  error: null,
  actions: {
    fetchSong: async (url, lyricsProcessor) => {
      set({ isLoading: true, error: null, song: null, lyrics: null });
      try {
        // Optimization: Check if the song already exists in the DB
        const existingSong = await db.songs.where('sourceUrl').equals(url).first();
        if (existingSong) {
          console.log("Found song in DB, loading from there.");
          set({ song: existingSong, lyrics: existingSong.lyrics, isLoading: false });
          return;
        }

        // 1. Fetch media info from our backend
        const mediaResponse = await fetch('http://localhost:8000/api/media/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });

        if (!mediaResponse.ok) {
          const errorData = await mediaResponse.json();
          throw new Error(errorData.detail || 'Failed to fetch media');
        }

        const songData: SongData = await mediaResponse.json();
        set({ song: songData }); // Set song data immediately

        // 2. Transcribe the audio
        const transcribeResponse = await fetch('http://localhost:8000/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_path: songData.local_path }),
        });

        if (!transcribeResponse.ok) {
            const errorData = await transcribeResponse.json();
            throw new Error(errorData.detail || 'Failed to transcribe audio');
        }

        const whisperData: WhisperXOutput = await transcribeResponse.json();

        // 3. Process the lyrics only if lyricsProcessor is provided (i.e., on the client)
        let processedLyrics: LyricLine[] = [];
        if (lyricsProcessor) {
            processedLyrics = await lyricsProcessor(whisperData);
        } else {
            // Fallback for SSR or if lyricsProcessor is not available
            // This might mean lyrics won't be available on first render for SSR
            console.warn("lyricsProcessor not available, skipping lyric processing.");
        }

        // 4. Save to IndexedDB
        const newSongRecord: SongRecord = {
          ...songData,
          sourceUrl: url,
          lyrics: processedLyrics,
          createdAt: new Date(),
        };
        await db.songs.add(newSongRecord);
        console.log("Saved new song to IndexedDB.");

        set({ lyrics: processedLyrics, isLoading: false });

      } catch (err) {
        const error = err as Error;
        console.error("Error in fetchSong action:", err);
        set({ error: error.message, isLoading: false, song: null, lyrics: null });
      }
    },
  },
}));

export default useSongStore;
