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
  // New fields for lyric fix LLM
  lyricFixLLMApiKey?: string | null;
  lyricFixLLMApiUrl?: string | null;
  lyricFixLLMModelType?: string | null;
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
    // New version for lyric fix LLM settings
    this.version(5).stores({
      settings: 'id, openaiApiKey, llmApiUrl, llmModelType, aiResponseLanguage, uiLanguage, lyricFixLLMApiKey, lyricFixLLMModelType, lyricFixLLMApiUrl',
    }).upgrade(async (tx) => {
      // For existing settings, initialize new fields to null or existing general settings if appropriate
      await tx.table('settings').toCollection().modify(setting => {
        if (setting.lyricFixLLMApiKey === undefined) {
          setting.lyricFixLLMApiKey = setting.openaiApiKey; // Default to general API key
        }
        if (setting.lyricFixLLMModelType === undefined) {
          setting.lyricFixLLMModelType = setting.llmModelType; // Default to general model type
        }
        if (setting.lyricFixLLMApiUrl === undefined) {
          setting.lyricFixLLMApiUrl = setting.llmApiUrl; // Default to general API URL
        }
      });
    });
  }
}

export const db = new JeloDB();
