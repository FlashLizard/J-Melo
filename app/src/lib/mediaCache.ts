import type { SongData } from '@/interfaces';
import { buildApiUrl, getJson, headOk } from '@/lib/backendClient';

export type MediaCacheSong = {
  media_url?: string | null;
  sourceUrl?: string | null;
};

export type MediaCacheUpdate = Partial<
  Pick<SongData, 'media_type' | 'title' | 'artist' | 'cover_url' | 'duration' | 'media_url' | 'local_path'>
>;

type MediaFetchResponse = Pick<SongData, 'media_type' | 'title' | 'artist' | 'cover_url' | 'duration' | 'media_url' | 'local_path'>;

export interface MediaCacheResult<T extends MediaCacheSong> {
  song: T;
  refreshed: boolean;
  available: boolean;
  playableUrl: string | null;
  updatePayload: MediaCacheUpdate | null;
}

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i;

export const getBackendMediaPath = (backendUrl: string, mediaUrl?: string | null) => {
  if (!mediaUrl) return null;
  if (mediaUrl.startsWith('blob:') || mediaUrl.startsWith('data:') || mediaUrl.startsWith('//')) return null;

  if (!ABSOLUTE_URL_PATTERN.test(mediaUrl)) {
    return mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`;
  }

  try {
    const media = new URL(mediaUrl);
    const backend = new URL(backendUrl);
    if (media.origin === backend.origin) {
      return `${media.pathname}${media.search}`;
    }
  } catch {
    return null;
  }

  return null;
};

export const getPlayableMediaUrl = (backendUrl: string, mediaUrl?: string | null) => {
  if (!mediaUrl) return null;
  if (ABSOLUTE_URL_PATTERN.test(mediaUrl) || mediaUrl.startsWith('//')) return mediaUrl;
  return buildApiUrl(backendUrl, mediaUrl);
};

const toUpdatePayload = (mediaInfo: MediaFetchResponse): MediaCacheUpdate => {
  const updatePayload: MediaCacheUpdate = {};
  const fields = ['media_type', 'title', 'artist', 'cover_url', 'duration', 'media_url', 'local_path'] as const;

  fields.forEach((field) => {
    if (mediaInfo[field] !== undefined) {
      updatePayload[field] = mediaInfo[field] as never;
    }
  });

  return updatePayload;
};

export const ensureBackendMediaCache = async <T extends MediaCacheSong>(
  backendUrl: string,
  song: T
): Promise<MediaCacheResult<T>> => {
  const refreshFromSource = async () => {
    if (!song.sourceUrl) {
      return {
        song,
        refreshed: false,
        available: false,
        playableUrl: null,
        updatePayload: null,
      };
    }

    const mediaInfo = await getJson<MediaFetchResponse>(backendUrl, '/api/media/fetch', { url: song.sourceUrl });
    const updatePayload = toUpdatePayload(mediaInfo);
    const refreshedSong = { ...song, ...updatePayload };

    return {
      song: refreshedSong,
      refreshed: true,
      available: Boolean(refreshedSong.media_url),
      playableUrl: getPlayableMediaUrl(backendUrl, refreshedSong.media_url),
      updatePayload,
    };
  };

  const backendMediaPath = getBackendMediaPath(backendUrl, song.media_url);
  const currentPlayableUrl = getPlayableMediaUrl(backendUrl, song.media_url);

  if (!backendMediaPath) {
    if (!currentPlayableUrl && song.sourceUrl) {
      return refreshFromSource();
    }

    return {
      song,
      refreshed: false,
      available: Boolean(currentPlayableUrl),
      playableUrl: currentPlayableUrl,
      updatePayload: null,
    };
  }

  if (await headOk(backendUrl, backendMediaPath)) {
    return {
      song,
      refreshed: false,
      available: true,
      playableUrl: getPlayableMediaUrl(backendUrl, backendMediaPath),
      updatePayload: null,
    };
  }

  return refreshFromSource();
};
