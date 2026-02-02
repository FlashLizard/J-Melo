// src/lib/db.ts
import Dexie, { Table } from 'dexie';
import { SongData } from '@/stores/useSongStore';
import { LyricLine } from './mock-data';

export interface SongRecord extends SongData {
  id?: number;
  sourceUrl: string;
  lyrics: LyricLine[];
  createdAt: Date;
}

export interface WordRecord {
  id?: number;
  surface: string;
  reading: string;
  romaji: string;
  definition: string;
  sourceSongId: number;
  createdAt: Date;
}

export interface Settings {
  id?: number; // Should always be 0 for singleton
  openaiApiKey: string | null;
  llmApiUrl: string | null;
  llmModelType: string | null;
  aiResponseLanguage: 'en' | 'zh'; // 'en' for English, 'zh' for Chinese
  uiLanguage: 'en' | 'zh';
}

class JeloDB extends Dexie {
  public songs!: Table<SongRecord, number>;
  public words!: Table<WordRecord, number>;
  public settings!: Table<Settings, number>;

  public constructor() {
    super('JeloDB');
    this.version(1).stores({
      songs: '++id, sourceUrl',
      words: '++id, surface, sourceSongId',
      settings: 'id',
    });
    this.version(2).stores({
      settings: 'id, openaiApiKey, llmApiUrl, llmModelType, uiLanguage',
    }).upgrade(tx => {});
    // Add a new version for the aiResponseLanguage field
    this.version(3).stores({
      settings: 'id, openaiApiKey, llmApiUrl, llmModelType, aiResponseLanguage, uiLanguage',
    }).upgrade(tx => {});
    // Add a new version for the words table change (adding createdAt index)
    this.version(4).stores({
      words: '++id, surface, sourceSongId, createdAt',
    }).upgrade(tx => {});
  }
}

export const db = new JeloDB();
