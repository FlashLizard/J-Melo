// src/stores/useSongStore.ts
import { create } from 'zustand';
import { LyricLine, LyricToken } from '@/interfaces/lyrics';
import { WhisperXOutput } from '@/hooks/useLyricsProcessor';
import { db, SongRecord } from '@/lib/db';

export interface SongData {
  media_type: 'video' | 'audio';
  title: string;
  artist: string | null;
  cover_url: string | null;
  duration: number;
  media_url: string;
  local_path: string;
  sourceUrl: string;
}

interface SongState {
  song: SongData | null;
  lyrics: LyricLine[] | null;
  whisperData: WhisperXOutput | null; // Add whisperData to the state
  isLoading: boolean;
  error: string | null;
}

const useSongStore = create<SongState>(() => ({
  song: null,
  lyrics: null,
  whisperData: null,
  isLoading: false,
  error: null,
}));

export const songStoreActions = {
  fetchSong: async (url: string) => {
    useSongStore.setState({ isLoading: true, error: null, song: null, lyrics: null, whisperData: null });
    try {
      const existingSong = await db.songs.where('sourceUrl').equals(url).first();
      if (existingSong) {
        useSongStore.setState({ song: existingSong, lyrics: existingSong.lyrics, isLoading: false });
        return;
      }
      const mediaResponse = await fetch('http://localhost:8000/api/media/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!mediaResponse.ok) throw new Error((await mediaResponse.json()).detail || 'Failed to fetch media');
      const songData: Omit<SongData, 'sourceUrl'> = await mediaResponse.json();
      
      // Manually re-attach the original source URL to the song object
      const songDataWithSource: SongData = { ...songData, sourceUrl: url };

      const transcribeResponse = await fetch('http://localhost:8000/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ local_path: songData.local_path }),
      });
      if (!transcribeResponse.ok) throw new Error((await transcribeResponse.json()).detail || 'Failed to transcribe audio');
      const whisperData: WhisperXOutput = await transcribeResponse.json();
      
      // Store songData (with sourceUrl) and whisperData
      useSongStore.setState({ song: songDataWithSource, whisperData: whisperData, isLoading: false });

    } catch (err) {
      useSongStore.setState({ error: (err as Error).message, isLoading: false, song: null, lyrics: null });
    }
  },
  setProcessedLyrics: (processedLyrics: LyricLine[]) => {
    useSongStore.setState((state) => {
      if (!state.song) return {};
      // Save to DB after processing
      const newSongRecord: SongRecord = {
        ...state.song,
        lyrics: processedLyrics,
        createdAt: new Date(),
      };
      db.songs.add(newSongRecord);
      return { lyrics: processedLyrics };
    });
  },
  updateLyricLine: (updatedLine: LyricLine) => {
    useSongStore.setState((state) => {
      if (!state.lyrics) return {};
      const newLyrics = state.lyrics.map(line =>
        line.id === updatedLine.id ? updatedLine : line
      );
      // Also update in DB
      const songRecord = state.song as SongRecord;
      if (songRecord && songRecord.id) {
        db.songs.update(songRecord.id, { lyrics: newLyrics });
      }
      return { lyrics: newLyrics };
    });
  },
};

export default useSongStore;

