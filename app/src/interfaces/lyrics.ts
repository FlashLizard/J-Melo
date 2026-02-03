// app/src/interfaces/lyrics.ts

export interface LyricToken {
  surface: string;
  reading: string;
  romaji: string;
  startTime: number;
  endTime: number;
  partOfSpeech: string;
}

export interface LyricLine {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  translation?: string;
  tokens: LyricToken[];
}