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
