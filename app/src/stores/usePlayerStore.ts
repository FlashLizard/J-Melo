// src/stores/usePlayerStore.ts
import { create } from 'zustand';
import { db } from '@/lib/db';
import useSettingsStore from './useSettingsStore';
import { ensureBackendMediaCache } from '@/lib/mediaCache';
import { getNeighborCandidateIds, type TrackDirection } from '@/lib/playlistNavigation';

export type PlayMode = 'sequential' | 'shuffle' | 'loop-single';

export interface PlaylistItem {
  id: number;
  title: string;
  artist: string | null;
  cover_url: string | null;
  media_url: string | null;
}

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopA: number | null;
  loopB: number | null;
  playbackRate: number;
  playMode: PlayMode;
  hasEnded: boolean;
  playlist: number[];
  currentSongId: number | null;
  nextTrack: PlaylistItem | null;
  prevTrack: PlaylistItem | null;
}

let mediaElement: HTMLAudioElement | HTMLVideoElement | null = null;
let rafId: number | null = null;
let isSeeking = false;
let isSwitchingSource = false;
let switchPlaybackRequestId = 0;
let neighborRequestId = 0;
let trackActionRequestId = 0;

// Singleton Audio for iOS stability
let globalAudioInstance: HTMLAudioElement | null = null;
const AUDIO_ATTACH_EVENTS = ['click', 'touchstart', 'pointerdown'] as const;

const removeAudioAttachListeners = () => {
    AUDIO_ATTACH_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, ensureGlobalAudioAttached);
    });
};

const ensureGlobalAudioAttached = () => {
    if (typeof document === 'undefined' || !globalAudioInstance || globalAudioInstance.parentElement) return;
    if (document.body) {
        document.body.appendChild(globalAudioInstance);
        removeAudioAttachListeners();
    }
};

if (typeof window !== 'undefined') {
    globalAudioInstance = new Audio();
    globalAudioInstance.preload = 'auto';
    globalAudioInstance.setAttribute('playsinline', 'true');
    globalAudioInstance.setAttribute('webkit-playsinline', 'true');
    globalAudioInstance.crossOrigin = 'anonymous';
    globalAudioInstance.style.display = 'none';

    AUDIO_ATTACH_EVENTS.forEach((eventName) => {
        document.addEventListener(eventName, ensureGlobalAudioAttached);
    });
}

const usePlayerStore = create<PlayerState>(() => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  loopA: null,
  loopB: null,
  playbackRate: 1.0,
  playMode: 'sequential',
  hasEnded: false,
  playlist: [],
  currentSongId: null,
  nextTrack: null,
  prevTrack: null,
}));

const syncPositionState = () => {
    if ('mediaSession' in navigator && mediaElement && mediaElement.duration && !isNaN(mediaElement.duration)) {
        try {
            navigator.mediaSession.setPositionState({
                duration: mediaElement.duration,
                playbackRate: mediaElement.playbackRate,
                position: mediaElement.currentTime
            });
        } catch (e) {
            console.warn("MediaSession: setPositionState failed", e);
        }
    }
};

const syncTimeState = () => {
    if (!mediaElement || isSeeking) return;
    const { loopA, loopB } = usePlayerStore.getState();
    const newTime = mediaElement.currentTime;
    if (loopA !== null && loopB !== null && newTime >= loopB) {
        mediaElement.currentTime = loopA;
        usePlayerStore.setState({ currentTime: loopA });
    } else {
        usePlayerStore.setState({ currentTime: newTime });
    }
};

const startAnimationLoop = () => {
    if (rafId) cancelAnimationFrame(rafId);
    const loop = () => {
        syncTimeState();
        if (usePlayerStore.getState().isPlaying) {
            rafId = requestAnimationFrame(loop);
        } else {
            rafId = null;
        }
    };
    rafId = requestAnimationFrame(loop);
};

const setupMediaHandlers = () => {
    if (!('mediaSession' in navigator)) return;
    
    const actions: [MediaSessionAction, () => void][] = [
        ['play', () => playerStoreActions.play()],
        ['pause', () => playerStoreActions.pause()],
        ['previoustrack', () => playerStoreActions.onPrevTrack()],
        ['nexttrack', () => playerStoreActions.onNextTrack()],
    ];

    actions.forEach(([action, handler]) => {
        try { navigator.mediaSession.setActionHandler(action, handler); } catch(e) {}
    });

    // Seek action (Enables progress bar dragging on iOS)
    // We REMOVED seekbackward/seekforward to let previoustrack/nexttrack take the button slots
    try {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime !== undefined) playerStoreActions.seek(details.seekTime);
        });
    } catch (e) {}
};

const handleLoadedMetadata = () => {
    if (mediaElement) {
        usePlayerStore.setState({ duration: mediaElement.duration });
        syncPositionState();
    }
};

const handlePlay = () => {
    usePlayerStore.setState({ isPlaying: true, hasEnded: false });
    startAnimationLoop();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    syncPositionState();
};

const handlePause = () => {
    if (isSwitchingSource) return;
    usePlayerStore.setState({ isPlaying: false });
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (mediaElement && !isSeeking) {
        usePlayerStore.setState({ currentTime: mediaElement.currentTime });
    }
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    syncPositionState();
};

const handleEnded = () => {
    if (isSwitchingSource) return;
    const { playMode } = usePlayerStore.getState();
    if (playMode === 'loop-single') {
        playerStoreActions.seek(0);
        playerStoreActions.play();
        return;
    }
    playerStoreActions.switchByDirection('next').then((switched) => {
        if (!switched) {
            usePlayerStore.setState({ isPlaying: false, hasEnded: true });
        }
    }).catch((error) => {
        console.error('Failed to switch to the next track after current track ended:', error);
        usePlayerStore.setState({ isPlaying: false, hasEnded: true });
    });
};

const handleTimeUpdate = () => {
    if (document.hidden || !rafId) {
        syncTimeState();
    }
};

const handleSeeking = () => { isSeeking = true; };
const handleSeeked = () => {
    isSeeking = false;
    if (mediaElement) {
        usePlayerStore.setState({ currentTime: mediaElement.currentTime });
        syncPositionState();
    }
};

const blobUrlCache = new Map<string, string>();
const getCachedBlobUrl = (songId: number, kind: 'audio' | 'cover', blob: Blob) => {
    const prefix = `${kind}:${songId}:`;
    const cacheKey = `${prefix}${blob.size}:${blob.type}`;
    const existingUrl = blobUrlCache.get(cacheKey);
    if (existingUrl) return existingUrl;

    Array.from(blobUrlCache.entries()).forEach(([key, url]) => {
        if (key.startsWith(prefix)) {
            URL.revokeObjectURL(url);
            blobUrlCache.delete(key);
        }
    });

    const url = URL.createObjectURL(blob);
    blobUrlCache.set(cacheKey, url);
    return url;
};

const getLocalizedUnknownArtist = () => (
    useSettingsStore.getState().settings.uiLanguage === 'zh' ? '未知艺术家' : 'Unknown Artist'
);

const resolvePlaylistItem = async (id: number): Promise<PlaylistItem | null> => {
    const song = await db.songs.get(id);
    if (!song) return null;

    const backendUrl = useSettingsStore.getState().settings.backendUrl;
    let playableSong = song;
    let mediaUrl: string | null = null;

    if (song.audioData) {
        mediaUrl = getCachedBlobUrl(id, 'audio', song.audioData);
    } else if (song.media_url) {
        try {
            const mediaCacheResult = await ensureBackendMediaCache(backendUrl, song);
            if (mediaCacheResult.updatePayload) {
                await db.songs.update(id, mediaCacheResult.updatePayload);
            }
            playableSong = mediaCacheResult.song;
            mediaUrl = mediaCacheResult.available ? mediaCacheResult.playableUrl : null;
        } catch (error) {
            console.error(`Failed to refresh media before switching to song ${id}:`, error);
            mediaUrl = null;
        }
    }

    let coverUrl = playableSong.cover_url;
    if (playableSong.coverImageData) coverUrl = getCachedBlobUrl(id, 'cover', playableSong.coverImageData);

    return {
        id,
        title: playableSong.title,
        artist: playableSong.artist,
        cover_url: coverUrl || '',
        media_url: mediaUrl,
    };
};

const resolveFirstPlayable = async (ids: number[]): Promise<PlaylistItem | null> => {
    for (const id of ids) {
        const item = await resolvePlaylistItem(id);
        if (item?.media_url) return item;
    }
    return null;
};

export const playerStoreActions = {
  onSongSwitch: null as ((id: number) => void) | null,

  getGlobalAudio: () => globalAudioInstance,

  setMediaElement: (element: HTMLAudioElement | HTMLVideoElement | null) => {
    if (mediaElement === element) return;
    if (element === globalAudioInstance) ensureGlobalAudioAttached();
    if (mediaElement) {
        mediaElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        mediaElement.removeEventListener('play', handlePlay);
        mediaElement.removeEventListener('playing', handlePlay);
        mediaElement.removeEventListener('pause', handlePause);
        mediaElement.removeEventListener('ended', handleEnded);
        mediaElement.removeEventListener('timeupdate', handleTimeUpdate);
        mediaElement.removeEventListener('seeking', handleSeeking);
        mediaElement.removeEventListener('seeked', handleSeeked);
    }
    mediaElement = element;
    if (element) {
        element.playbackRate = usePlayerStore.getState().playbackRate;
        element.addEventListener('loadedmetadata', handleLoadedMetadata);
        element.addEventListener('play', handlePlay);
        element.addEventListener('playing', handlePlay);
        element.addEventListener('pause', handlePause);
        element.addEventListener('ended', handleEnded);
        element.addEventListener('timeupdate', handleTimeUpdate);
        element.addEventListener('seeking', handleSeeking);
        element.addEventListener('seeked', handleSeeked);
        if (usePlayerStore.getState().isPlaying) startAnimationLoop();
        if (element.duration) usePlayerStore.setState({ duration: element.duration });
        setupMediaHandlers();
    }
  },

  updateMetadata: (title: string, artist: string, artworkUrl: string) => {
    if ('mediaSession' in navigator && (window as any).MediaMetadata) {
        let absoluteArtworkUrl = artworkUrl;
        if (!artworkUrl.startsWith('http') && !artworkUrl.startsWith('blob:') && !artworkUrl.startsWith('data:')) {
            absoluteArtworkUrl = `${window.location.origin}${artworkUrl}`;
        }

        navigator.mediaSession.metadata = new (window as any).MediaMetadata({
            title, 
            artist,
            album: 'J-Melo Library',
            artwork: [
                { src: absoluteArtworkUrl, sizes: '96x96', type: 'image/png' },
                { src: absoluteArtworkUrl, sizes: '128x128', type: 'image/png' },
                { src: absoluteArtworkUrl, sizes: '192x192', type: 'image/png' },
                { src: absoluteArtworkUrl, sizes: '256x256', type: 'image/png' },
                { src: absoluteArtworkUrl, sizes: '384x384', type: 'image/png' },
                { src: absoluteArtworkUrl, sizes: '512x512', type: 'image/png' },
            ]
        });
        
        setupMediaHandlers();
        syncPositionState();
    }
  },

  prepareNeighbors: async (currentId: number) => {
    const requestId = ++neighborRequestId;
    const { playlist, playMode } = usePlayerStore.getState();
    usePlayerStore.setState({ nextTrack: null, prevTrack: null });
    if (playlist.length === 0) return;

    const [next, prev] = await Promise.all([
        resolveFirstPlayable(getNeighborCandidateIds({ playlist, currentId, playMode, direction: 'next' })),
        resolveFirstPlayable(getNeighborCandidateIds({ playlist, currentId, playMode, direction: 'prev' })),
    ]);

    const latest = usePlayerStore.getState();
    if (requestId !== neighborRequestId || latest.currentSongId !== currentId) return;
    usePlayerStore.setState({ nextTrack: next, prevTrack: prev });
  },

  switchTrack: async (song: PlaylistItem) => {
    if (!mediaElement) return;
    const playbackRequestId = ++switchPlaybackRequestId;
    const resolvedSong = await resolvePlaylistItem(song.id);
    if (playbackRequestId !== switchPlaybackRequestId) return;

    if (!resolvedSong?.media_url) {
        console.error(`Cannot switch to song ${song.id}: no playable media URL.`);
        mediaElement.pause();
        isSwitchingSource = false;
        usePlayerStore.setState({ isPlaying: false, hasEnded: true });
        return;
    }

    song = resolvedSong;
    if (mediaElement === globalAudioInstance) ensureGlobalAudioAttached();
    
    isSwitchingSource = true;
    const previousSongId = usePlayerStore.getState().currentSongId;
    usePlayerStore.setState({ 
        currentSongId: song.id, 
        isPlaying: true,
        hasEnded: false, 
        currentTime: 0,
        duration: 0,
        loopA: null,
        loopB: null,
    });
    
    const absoluteTargetUrl = new URL(song.media_url, window.location.href).href;
    const switchedElement = mediaElement;
    if (mediaElement.src !== absoluteTargetUrl) {
        mediaElement.autoplay = true;
        mediaElement.src = absoluteTargetUrl;
        mediaElement.load();
    } else if (previousSongId !== song.id) {
        mediaElement.currentTime = 0;
    }
    
    mediaElement.muted = false;
    mediaElement.volume = 1.0;
    
    const markSwitchPlaying = () => {
        if (playbackRequestId !== switchPlaybackRequestId || mediaElement !== switchedElement) return;
        isSwitchingSource = false;
        usePlayerStore.setState({ isPlaying: true, hasEnded: false });
        syncPositionState();
    };

    const markSwitchFailed = (error: unknown) => {
        if (playbackRequestId !== switchPlaybackRequestId || mediaElement !== switchedElement) return;
        console.error("Switch play failed", error);
        isSwitchingSource = false;
        usePlayerStore.setState({ isPlaying: false, hasEnded: true });
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    };

    const playSwitchedTrack = (attempt = 0) => {
        if (playbackRequestId !== switchPlaybackRequestId || mediaElement !== switchedElement) return;
        const playPromise = switchedElement.play();
        if (playPromise !== undefined) {
            playPromise.then(markSwitchPlaying).catch((error) => {
                if (attempt < 2 && switchedElement.readyState < 3) {
                    let didRetry = false;
                    const retry = () => {
                        if (didRetry) return;
                        didRetry = true;
                        playSwitchedTrack(attempt + 1);
                    };
                    switchedElement.addEventListener('canplay', retry, { once: true });
                    window.setTimeout(retry, 350);
                    return;
                }
                markSwitchFailed(error);
            });
        } else {
            markSwitchPlaying();
        }
    };

    playSwitchedTrack();

    if (mediaElement.autoplay) {
        mediaElement.addEventListener('playing', () => {
            if (playbackRequestId === switchPlaybackRequestId) {
                isSwitchingSource = false;
            }
        }, { once: true });
    }
    
    playerStoreActions.updateMetadata(song.title, song.artist || getLocalizedUnknownArtist(), song.cover_url || '');
    playerStoreActions.prepareNeighbors(song.id);
    
    if (playerStoreActions.onSongSwitch) playerStoreActions.onSongSwitch(song.id);
    startAnimationLoop();
  },

  switchByDirection: async (direction: TrackDirection) => {
      const actionRequestId = ++trackActionRequestId;
      const { currentSongId, playlist, playMode } = usePlayerStore.getState();
      if (!currentSongId) return false;

      const candidateIds = getNeighborCandidateIds({ playlist, currentId: currentSongId, playMode, direction });
      const target = await resolveFirstPlayable(candidateIds);

      if (actionRequestId !== trackActionRequestId || usePlayerStore.getState().currentSongId !== currentSongId) {
          return false;
      }
      if (!target || target.id === currentSongId) return false;

      await playerStoreActions.switchTrack(target);
      return true;
  },

  onNextTrack: () => {
      playerStoreActions.switchByDirection('next').catch((error) => {
          console.error('Failed to switch to next track:', error);
      });
  },
  onPrevTrack: () => {
      playerStoreActions.switchByDirection('prev').catch((error) => {
          console.error('Failed to switch to previous track:', error);
      });
  },

  setPlaylist: (ids: number[]) => {
      usePlayerStore.setState({ playlist: ids });
      const { currentSongId } = usePlayerStore.getState();
      if (currentSongId) playerStoreActions.prepareNeighbors(currentSongId);
  },
  setCurrentSongId: (id: number | null) => {
      const current = usePlayerStore.getState().currentSongId;
      if (current === id) return;
      usePlayerStore.setState({ currentSongId: id });
      if (id) playerStoreActions.prepareNeighbors(id);
  },

  play: () => { 
      if (mediaElement) {
          if (mediaElement === globalAudioInstance) ensureGlobalAudioAttached();
          const playPromise = mediaElement.play();
          if (playPromise !== undefined) {
              playPromise.catch(e => {
                  console.error("Play error", e);
                  usePlayerStore.setState({ isPlaying: false });
                  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
              });
          } else {
              usePlayerStore.setState({ isPlaying: true });
          }
          startAnimationLoop();
          syncPositionState();
      }
  },
  pause: () => { 
      mediaElement?.pause();
      usePlayerStore.setState({ isPlaying: false });
      syncPositionState();
  },
  togglePlay: () => {
    const { isPlaying } = usePlayerStore.getState();
    if (isPlaying) playerStoreActions.pause(); else playerStoreActions.play();
  },
  setPlaybackRate: (rate: number) => {
    if (mediaElement) mediaElement.playbackRate = rate;
    usePlayerStore.setState({ playbackRate: rate });
    syncPositionState();
  },
  seek: (time: number) => { 
    if (mediaElement) {
        isSeeking = true;
        mediaElement.currentTime = time; 
        usePlayerStore.setState({ currentTime: time });
        syncPositionState();
    }
  },
  setLoopA: () => usePlayerStore.setState({ loopA: usePlayerStore.getState().currentTime, loopB: null }),
  setLoopB: () => {
    const { currentTime, loopA } = usePlayerStore.getState();
    if (loopA !== null && currentTime > loopA) usePlayerStore.setState({ loopB: currentTime });
  },
  clearLoop: () => usePlayerStore.setState({ loopA: null, loopB: null }),
  togglePlayMode: () => {
    const modes: PlayMode[] = ['sequential', 'shuffle', 'loop-single'];
    const currentMode = usePlayerStore.getState().playMode;
    const nextMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];
    usePlayerStore.setState({ playMode: nextMode });
    const { currentSongId } = usePlayerStore.getState();
    if (currentSongId) playerStoreActions.prepareNeighbors(currentSongId);
  },
  clearHasEnded: () => usePlayerStore.setState({ hasEnded: false }),
};

export default usePlayerStore;
