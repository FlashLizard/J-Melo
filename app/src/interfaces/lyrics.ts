// src/interfaces/lyrics.ts

export interface LyricToken {
    surface: string;
    reading: string;
    romaji?: string;
    startTime: number;
    endTime: number;
    partOfSpeech?: string;
}
  
export interface LyricLine {
    startTime: number;
    endTime: number;
    text: string;
    tokens: LyricToken[];
    translation?: string;
}

export interface WhisperXWord {
    word: string;
    start: number;
    end: number;
    score: number;
}

export interface WhisperXSegment {
    start: number;
    end: number;
    text: string;
    words: WhisperXWord[];
}

export interface WhisperXOutput {
    segments: WhisperXSegment[];
    language: string;
}
