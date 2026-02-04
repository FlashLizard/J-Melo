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
  cardFront: string; // Replaces 'definition'
  cardBack: string;  // Replaces 'definition'
  sourceSongId: number;
  createdAt: Date;
}

export interface Settings {
  id?: number; // Should always be 0 for singleton
  openaiApiKey: string | null;
  llmApiUrl: string | null;
  llmModelType: string | null;
  aiResponseLanguage: 'en' | 'zh';
  uiLanguage: 'en' | 'zh';
  lyricFixLLMApiKey?: string | null;
  lyricFixLLMApiUrl?: string | null;
  lyricFixLLMModelType?: string | null;
  defaultPromptTemplateId?: number;
  defaultCardTemplateId?: number;
}

export interface PromptTemplate {
  id?: number;
  name: string;
  content: string;
  createdAt: Date;
}

export interface CardTemplate {
  id?: number;
  name: string;
  front: string;
  back: string;
  createdAt: Date;
}

class JeloDB extends Dexie {
  public songs!: Table<SongRecord, number>;
  public words!: Table<WordRecord, number>;
  public settings!: Table<Settings, number>;
  public promptTemplates!: Table<PromptTemplate, number>;
  public cardTemplates!: Table<CardTemplate, number>;

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
    this.version(3).stores({
      settings: 'id, openaiApiKey, llmApiUrl, llmModelType, aiResponseLanguage, uiLanguage',
    }).upgrade(tx => {});
    this.version(4).stores({
      words: '++id, surface, sourceSongId, createdAt',
    }).upgrade(tx => {});
    this.version(5).stores({
      settings: 'id, openaiApiKey, llmApiUrl, llmModelType, aiResponseLanguage, uiLanguage, lyricFixLLMApiKey, lyricFixLLMModelType, lyricFixLLMApiUrl',
    }).upgrade(async (tx) => {
      await tx.table('settings').toCollection().modify(setting => {
        if (setting.lyricFixLLMApiKey === undefined) setting.lyricFixLLMApiKey = setting.openaiApiKey;
        if (setting.lyricFixLLMModelType === undefined) setting.lyricFixLLMModelType = setting.llmModelType;
        if (setting.lyricFixLLMApiUrl === undefined) setting.lyricFixLLMApiUrl = setting.llmApiUrl;
      });
    });
    this.version(6).stores({
      words: '++id, surface, sourceSongId, createdAt', // `definition` is removed
      promptTemplates: '++id, name',
      cardTemplates: '++id, name',
      settings: 'id, openaiApiKey, llmApiUrl, llmModelType, aiResponseLanguage, uiLanguage, lyricFixLLMApiKey, lyricFixLLMModelType, lyricFixLLMApiUrl, defaultPromptTemplateId, defaultCardTemplateId',
    }).upgrade(async (tx) => {
      // Migrate existing words to the new card format
      await tx.table('words').toCollection().modify(word => {
        word.cardFront = word.surface; // Default front
        word.cardBack = `${word.reading}\n\n${word.definition}` // Default back
        delete word.definition; // Remove old field
      });
    });
  }
}

export const db = new JeloDB();