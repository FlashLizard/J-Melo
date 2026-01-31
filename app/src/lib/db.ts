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
  uiLanguage: 'en' | 'zh';
}

class JeloDB extends Dexie {
  public songs!: Table<SongRecord, number>;
  public words!: Table<WordRecord, number>;
  public settings!: Table<Settings, number>;

  public constructor() {
    super('JeloDB');
    this.version(1).stores({
      // sourceUrl is indexed for quick lookups
      songs: '++id, sourceUrl',
      // surface is indexed for the vocabulary list
      words: '++id, surface, sourceSongId',
      // Singleton settings table
      settings: 'id',
    });
  }
}

export const db = new JeloDB();
