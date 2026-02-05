// src/lib/db.ts
import Dexie, { Table } from 'dexie';
import { SongData } from '@/stores/useSongStore';
import { LyricLine } from '../interfaces/lyrics';

export interface SongRecord extends SongData {
  id?: number;
  sourceUrl: string;
  lyrics: LyricLine[];
  createdAt: Date;
  audioData?: Blob; // Field to store the cached audio file
  coverImageData?: Blob; // Field to store the cached cover image
  is_cached: boolean; // Explicitly track caching status
}

export interface WordRecord {
  id?: number;
  surface: string;
  reading: string;
  romaji: string;
  cardFront: string;
  cardBack: string;
  sourceSongId: number;
  createdAt: Date;
  proficiency: number;
}

export interface Settings {
  id?: number;
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
  showReadings: boolean; // New setting for hiragana display
  showTranslations: boolean; // New setting for translation display
  translationLLMApiKey?: string | null; // New: API Key for translation
  translationLLMApiUrl?: string | null; // New: API URL for translation
  translationLLMModelType?: string | null; // New: Model Type for translation
  targetTranslationLanguage: string; // New: Target language for translation, e.g., 'en', 'zh', 'ja'
  backendUrl: string; // New: Backend URL
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
      words: '++id, surface, sourceSongId, createdAt, cardFront, cardBack',
      promptTemplates: '++id, name',
      cardTemplates: '++id, name',
      settings: 'id, openaiApiKey, llmApiUrl, llmModelType, aiResponseLanguage, uiLanguage, lyricFixLLMApiKey, lyricFixLLMModelType, lyricFixLLMApiUrl, defaultPromptTemplateId, defaultCardTemplateId',
    }).upgrade(async (tx) => {
      await tx.table('words').toCollection().modify(word => {
        if (word.definition) {
          word.cardFront = word.surface;
          word.cardBack = `${word.reading}\n\n${word.definition}`;
          delete word.definition;
        }
      });
    });
    this.version(7).stores({
      words: '++id, surface, sourceSongId, createdAt, proficiency, cardFront, cardBack'
    }).upgrade(async (tx) => {
      await tx.table('words').toCollection().modify(word => {
        if (word.proficiency === undefined) {
          word.proficiency = 0;
        }
      });
    });
    this.version(8).stores({
        songs: '++id, sourceUrl, audioData'
    });
    this.version(9).stores({
        songs: '++id, sourceUrl, audioData, coverImageData'
    });
    this.version(10).stores({
        songs: '++id, sourceUrl, audioData, coverImageData, is_cached'
    }).upgrade(async (tx) => {
      await tx.table('songs').toCollection().modify(song => {
        if (song.is_cached === undefined) {
          song.is_cached = !!song.audioData;
        }
      });
    });
    this.version(11).stores({
      settings: 'id, openaiApiKey, llmApiUrl, llmModelType, aiResponseLanguage, uiLanguage, lyricFixLLMApiKey, lyricFixLLMModelType, lyricFixLLMApiUrl, defaultPromptTemplateId, defaultCardTemplateId, showReadings, showTranslations',
    }).upgrade(async (tx) => {
      await tx.table('settings').toCollection().modify(setting => {
        if (setting.showReadings === undefined) setting.showReadings = true;
        if (setting.showTranslations === undefined) setting.showTranslations = true;
      });
    });
    this.version(12).stores({
      settings: 'id, openaiApiKey, llmApiUrl, llmModelType, aiResponseLanguage, uiLanguage, lyricFixLLMApiKey, lyricFixLLMModelType, lyricFixLLMApiUrl, defaultPromptTemplateId, defaultCardTemplateId, showReadings, showTranslations, translationLLMApiKey, translationLLMApiUrl, translationLLMModelType, targetTranslationLanguage',
    }).upgrade(async (tx) => {
      await tx.table('settings').toCollection().modify(setting => {
        if (setting.translationLLMApiKey === undefined) setting.translationLLMApiKey = null;
        if (setting.translationLLMApiUrl === undefined) setting.translationLLMApiUrl = null;
        if (setting.translationLLMModelType === undefined) setting.translationLLMModelType = null;
        if (setting.targetTranslationLanguage === undefined) setting.targetTranslationLanguage = 'en'; // Default to English
      });
    });
    this.version(13).stores({}).upgrade(async (tx) => { // New version for lyrics translation field
      // Ensure 'lyrics' has 'translation' field for existing entries
      await tx.table('songs').toCollection().modify(song => {
        if (song.lyrics && Array.isArray(song.lyrics)) {
          song.lyrics = song.lyrics.map(line => {
            if (line.translation === undefined) {
              return { ...line, translation: undefined };
            }
            return line;
          });
        }
      });
    });
    this.version(14).stores({
      settings: 'id, openaiApiKey, llmApiUrl, llmModelType, aiResponseLanguage, uiLanguage, lyricFixLLMApiKey, lyricFixLLMModelType, lyricFixLLMApiUrl, defaultPromptTemplateId, defaultCardTemplateId, showReadings, showTranslations, translationLLMApiKey, translationLLMApiUrl, translationLLMModelType, targetTranslationLanguage, backendUrl',
    }).upgrade(async (tx) => {
      await tx.table('settings').toCollection().modify(setting => {
        if (setting.backendUrl === undefined) setting.backendUrl = 'http://localhost:8000'; // Default value
      });
    });
  }
}

export const db = new JeloDB();
