// You can include shared interfaces/types in a separate file
// and then use them in any component by importing them. For
// example, to import the interface below do:
//
// import { User } from 'path/to/interfaces';

export type User = {
  id: number;
  name: string;
};

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
  is_cached?: boolean;
}
