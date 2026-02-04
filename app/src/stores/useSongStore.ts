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
}

interface SongState {
  song: SongData | null;
  lyrics: LyricLine[] | null;
  previewLyrics: LyricLine[] | null;
  whisperData: WhisperXOutput | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchSong: (url: string) => Promise<void>;
  setProcessedLyrics: (lyrics: LyricLine[]) => void;
  updateLyricLine: (updatedLine: LyricLine) => void;
  updateSongInfo: (info: { title: string; artist: string }) => void;
  setPreviewLyrics: (lyrics: LyricLine[]) => void;
  clearPreviewLyrics: () => void;
  commitPreviewLyrics: () => void;
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
      try {
        const existingSong = await db.songs.where('sourceUrl').equals(url).first();
        if (existingSong) {
          set({ song: existingSong, lyrics: existingSong.lyrics, isLoading: false });
          return;
        }
        const mediaResponse = await fetch(`http://localhost:8000/api/media/fetch?url=${encodeURIComponent(url)}`);
        if (!mediaResponse.ok) throw new Error((await mediaResponse.json()).detail || 'Failed to fetch media');
        
        let songData: Omit<SongData, 'sourceUrl'> = await mediaResponse.json();
        
        if (songData.cover_url) {
          songData.cover_url = `http://localhost:8000/api/media/proxy-image?url=${encodeURIComponent(songData.cover_url)}`;
        }
        
        const songDataWithSource: SongData = { ...songData, sourceUrl: url };
        
        const transcribeResponse = await fetch('http://localhost:8000/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_path: songData.local_path }),
        });
        if (!transcribeResponse.ok) throw new Error((await transcribeResponse.json()).detail || 'Failed to transcribe audio');
        const whisperData: WhisperXOutput = await transcribeResponse.json();

        set({ song: songDataWithSource, whisperData: whisperData, isLoading: false });

      } catch (err) {
        set({ error: (err as Error).message, isLoading: false, song: null, lyrics: null });
      }
    },

    setProcessedLyrics: (processedLyrics) => {
      const { song } = get();
      if (!song) return;
      
      const newSongRecord: SongRecord = {
        ...song,
        lyrics: processedLyrics,
        createdAt: new Date(),
        // Ensure proficiency is initialized if it's not part of SongData
        proficiency: 0
      };

      db.songs.add(newSongRecord).then(id => {
        set(state => {
          if(state.song) state.song.id = id;
        });
      });
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

// We no longer need the separate songStoreActions object
// Actions are now part of the store and accessed via the hook itself.

export default useSongStore;