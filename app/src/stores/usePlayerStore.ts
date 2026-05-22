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
let isRecoveringPlayback = false;
let playbackIntent = false;
let shouldResumeAfterForeground = false;
let switchPlaybackRequestId = 0;
let playbackRecoveryRequestId = 0;
let neighborRequestId = 0;
let trackActionRequestId = 0;
let foregroundResumeTimer: number | null = null;
let lifecycleHandlersInitialized = false;
let needsPipelineResetAfterMediaSessionPause = false;

// Singleton Audio for iOS stability
let globalAudioInstance: HTMLAudioElement | null = null;
const AUDIO_ATTACH_EVENTS = ['click', 'touchstart', 'pointerdown'] as const;
const MEDIA_READY_STATE = 3;
const SWITCH_PLAY_RETRY_DELAYS = [0, 250, 700];
const PLAYBACK_START_TIMEOUT_MS = 1200;
const IOS_FOREGROUND_RECOVERY_DELAY_MS = 120;

const isIOSWebKit = () => {
    if (typeof navigator === 'undefined') return false;
    const platform = navigator.platform || '';
    const userAgent = navigator.userAgent || '';
    const isTouchMac = platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return /iP(hone|ad|od)/.test(platform) || /iP(hone|ad|od)/.test(userAgent) || isTouchMac;
};

const isDocumentHidden = () => typeof document !== 'undefined' && document.hidden;

const setPlaybackIntent = (shouldPlay: boolean) => {
    playbackIntent = shouldPlay;
    if (!shouldPlay) shouldResumeAfterForeground = false;
};

type PlayOptions = {
    forcePipelineReset?: boolean;
    reason?: string;
};

type PauseOptions = {
    fromMediaSession?: boolean;
};

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
    globalAudioInstance.style.position = 'fixed';
    globalAudioInstance.style.left = '0';
    globalAudioInstance.style.bottom = '0';
    globalAudioInstance.style.width = '1px';
    globalAudioInstance.style.height = '1px';
    globalAudioInstance.style.opacity = '0';
    globalAudioInstance.style.pointerEvents = 'none';
    globalAudioInstance.style.zIndex = '-1';

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
        ['play', () => playerStoreActions.play({ forcePipelineReset: isIOSWebKit(), reason: 'media-session-play' })],
        ['pause', () => playerStoreActions.pause({ fromMediaSession: true })],
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
    setPlaybackIntent(true);
    usePlayerStore.setState({ isPlaying: true, hasEnded: false });
    startAnimationLoop();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    syncPositionState();
};

const handlePause = () => {
    if (isSwitchingSource || isRecoveringPlayback) return;
    if (isDocumentHidden() && playbackIntent) {
        shouldResumeAfterForeground = true;
    }
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
            setPlaybackIntent(false);
            usePlayerStore.setState({ isPlaying: false, hasEnded: true });
        }
    }).catch((error) => {
        console.error('Failed to switch to the next track after current track ended:', error);
        setPlaybackIntent(false);
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

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const waitForMediaReady = (element: HTMLMediaElement, timeoutMs: number): Promise<boolean> => {
    if (element.readyState >= MEDIA_READY_STATE) return Promise.resolve(true);

    return new Promise((resolve) => {
        let settled = false;
        const cleanup = () => {
            element.removeEventListener('canplay', onReady);
            element.removeEventListener('playing', onReady);
            element.removeEventListener('loadeddata', onReady);
            element.removeEventListener('error', onError);
            window.clearTimeout(timer);
        };
        const finish = (ready: boolean) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(ready);
        };
        const onReady = () => finish(element.readyState >= 2);
        const onError = () => finish(false);
        const timer = window.setTimeout(() => finish(element.readyState >= 2), timeoutMs);

        element.addEventListener('canplay', onReady, { once: true });
        element.addEventListener('playing', onReady, { once: true });
        element.addEventListener('loadeddata', onReady, { once: true });
        element.addEventListener('error', onError, { once: true });
    });
};

const waitForPlaybackStart = (element: HTMLMediaElement, timeoutMs: number): Promise<boolean> => {
    if (!element.paused && !element.ended && element.readyState >= 2) return Promise.resolve(true);

    return new Promise((resolve) => {
        let settled = false;
        const cleanup = () => {
            element.removeEventListener('playing', onProgress);
            element.removeEventListener('timeupdate', onProgress);
            element.removeEventListener('canplay', onProgress);
            element.removeEventListener('error', onError);
            window.clearTimeout(timer);
        };
        const finish = (started: boolean) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(started);
        };
        const hasStarted = () => !element.paused && !element.ended && element.readyState >= 2;
        const onProgress = () => {
            if (hasStarted()) finish(true);
        };
        const onError = () => finish(false);
        const timer = window.setTimeout(() => finish(hasStarted()), timeoutMs);

        element.addEventListener('playing', onProgress, { once: true });
        element.addEventListener('timeupdate', onProgress, { once: true });
        element.addEventListener('canplay', onProgress, { once: true });
        element.addEventListener('error', onError, { once: true });
    });
};

const forcePlaybackForSwitch = async (
    element: HTMLMediaElement,
    requestId: number,
    isStale: () => boolean,
) => {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < SWITCH_PLAY_RETRY_DELAYS.length; attempt += 1) {
        if (isStale()) return false;

        const delay = SWITCH_PLAY_RETRY_DELAYS[attempt];
        if (delay > 0) await wait(delay);
        if (isStale()) return false;

        try {
            element.muted = false;
            element.volume = 1.0;
        } catch {
            // iOS may ignore programmatic volume. Muted is the important flag here.
        }

        if (element.readyState < 2) {
            await waitForMediaReady(element, attempt === 0 ? 450 : 900);
        }
        if (isStale()) return false;

        try {
            const playPromise = element.play();
            if (playPromise !== undefined) await playPromise;
        } catch (error) {
            lastError = error;
        }

        if (isStale()) return false;
        if (await waitForPlaybackStart(element, PLAYBACK_START_TIMEOUT_MS)) return true;
    }

    throw lastError || new Error(`Playback did not start for switch request ${requestId}`);
};

const shouldRecoverPlayback = () => {
    const state = usePlayerStore.getState();
    return Boolean(
        mediaElement?.src &&
        !state.hasEnded &&
        (playbackIntent || state.isPlaying)
    );
};

const resetMediaPipelineAtCurrentTime = async (element: HTMLMediaElement) => {
    const source = element.currentSrc || element.src;
    if (!source) return;

    const state = usePlayerStore.getState();
    const resumeAt = Number.isFinite(element.currentTime) && element.currentTime > 0
        ? element.currentTime
        : state.currentTime;
    const playbackRate = state.playbackRate;

    try {
        element.pause();
    } catch {
        // Ignore platform-specific pause failures during lifecycle recovery.
    }

    element.preload = 'auto';
    if (element.src !== source) {
        element.src = source;
    } else {
        element.removeAttribute('src');
        element.load();
        await wait(0);
        element.src = source;
    }
    element.load();
    await waitForMediaReady(element, 1200);

    if (Number.isFinite(resumeAt) && resumeAt > 0) {
        const duration = Number.isFinite(element.duration) ? element.duration : state.duration;
        const safeResumeAt = duration > 0 ? Math.min(resumeAt, Math.max(0, duration - 0.25)) : resumeAt;
        try {
            element.currentTime = safeResumeAt;
            usePlayerStore.setState({ currentTime: safeResumeAt });
        } catch (error) {
            console.warn('Failed to restore media position after iOS foreground recovery:', error);
        }
    }

    element.playbackRate = playbackRate;
};

const recoverPlaybackAfterForeground = async (reason: string, forcePipelineReset: boolean) => {
    const element = mediaElement;
    if (!element || !shouldRecoverPlayback()) return false;

    const requestId = ++playbackRecoveryRequestId;
    const isStale = () => (
        requestId !== playbackRecoveryRequestId ||
        mediaElement !== element ||
        !shouldRecoverPlayback()
    );

    isRecoveringPlayback = true;
    try {
        if (element === globalAudioInstance) ensureGlobalAudioAttached();
        try {
            element.muted = false;
            element.volume = 1.0;
        } catch {
            // iOS ignores programmatic volume. Clearing muted is still useful.
        }

        if (forcePipelineReset) {
            await resetMediaPipelineAtCurrentTime(element);
            if (isStale()) return false;
        }

        const started = await forcePlaybackForSwitch(element, requestId, isStale);
        if (started && !isStale()) {
            setPlaybackIntent(true);
            needsPipelineResetAfterMediaSessionPause = false;
            shouldResumeAfterForeground = false;
            usePlayerStore.setState({ isPlaying: true, hasEnded: false });
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
            startAnimationLoop();
            syncPositionState();
            return true;
        }
    } catch (error) {
        console.warn(`Failed to recover playback after ${reason}:`, error);
    } finally {
        isRecoveringPlayback = false;
    }

    return false;
};

const scheduleForegroundPlaybackRecovery = (reason: string) => {
    if (typeof window === 'undefined' || !shouldRecoverPlayback()) return;
    if (foregroundResumeTimer !== null) {
        window.clearTimeout(foregroundResumeTimer);
    }

    foregroundResumeTimer = window.setTimeout(() => {
        foregroundResumeTimer = null;
        const forcePipelineReset = isIOSWebKit() && shouldResumeAfterForeground;
        recoverPlaybackAfterForeground(reason, forcePipelineReset).catch((error) => {
            console.warn(`Unhandled playback recovery failure after ${reason}:`, error);
        });
    }, IOS_FOREGROUND_RECOVERY_DELAY_MS);
};

const initPlaybackLifecycleHandlers = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (lifecycleHandlersInitialized) return;
    lifecycleHandlersInitialized = true;

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (playbackIntent || usePlayerStore.getState().isPlaying) {
                shouldResumeAfterForeground = true;
            }
            return;
        }
        if (shouldResumeAfterForeground || playbackIntent) {
            scheduleForegroundPlaybackRecovery('visibilitychange');
        }
    });

    window.addEventListener('pagehide', () => {
        if (playbackIntent || usePlayerStore.getState().isPlaying) {
            shouldResumeAfterForeground = true;
        }
    });

    window.addEventListener('pageshow', () => {
        if (shouldResumeAfterForeground || playbackIntent) {
            scheduleForegroundPlaybackRecovery('pageshow');
        }
    });

    window.addEventListener('focus', () => {
        if (shouldResumeAfterForeground) {
            scheduleForegroundPlaybackRecovery('focus');
        }
    });
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
    if (!mediaElement && globalAudioInstance) {
        playerStoreActions.setMediaElement(globalAudioInstance);
    }
    if (!mediaElement) return;
    const playbackRequestId = ++switchPlaybackRequestId;
    const resolvedSong = song.media_url ? song : await resolvePlaylistItem(song.id);
    if (playbackRequestId !== switchPlaybackRequestId) return;

    if (!resolvedSong?.media_url) {
        console.error(`Cannot switch to song ${song.id}: no playable media URL.`);
        setPlaybackIntent(false);
        needsPipelineResetAfterMediaSessionPause = false;
        mediaElement.pause();
        isSwitchingSource = false;
        usePlayerStore.setState({ isPlaying: false, hasEnded: true });
        return;
    }

    song = resolvedSong;
    if (mediaElement === globalAudioInstance) ensureGlobalAudioAttached();
    
    setPlaybackIntent(true);
    needsPipelineResetAfterMediaSessionPause = false;
    isSwitchingSource = true;
    const previousSongId = usePlayerStore.getState().currentSongId;
    const switchedElement = mediaElement;
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
    if (switchedElement.src !== absoluteTargetUrl) {
        switchedElement.autoplay = true;
        switchedElement.preload = 'auto';
        switchedElement.src = absoluteTargetUrl;
        switchedElement.load();
    } else if (previousSongId !== song.id) {
        switchedElement.currentTime = 0;
    }
    
    playerStoreActions.updateMetadata(song.title, song.artist || getLocalizedUnknownArtist(), song.cover_url || '');
    playerStoreActions.prepareNeighbors(song.id);
    
    const markSwitchPlaying = () => {
        if (playbackRequestId !== switchPlaybackRequestId || mediaElement !== switchedElement) return;
        isSwitchingSource = false;
        setPlaybackIntent(true);
        usePlayerStore.setState({ isPlaying: true, hasEnded: false });
        syncPositionState();
    };

    const markSwitchFailed = (error: unknown) => {
        if (playbackRequestId !== switchPlaybackRequestId || mediaElement !== switchedElement) return;
        console.error("Switch play failed", error);
        isSwitchingSource = false;
        setPlaybackIntent(false);
        usePlayerStore.setState({ isPlaying: false, hasEnded: true });
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    };

    const isStaleSwitch = () => playbackRequestId !== switchPlaybackRequestId || mediaElement !== switchedElement;
    try {
        const started = await forcePlaybackForSwitch(switchedElement, playbackRequestId, isStaleSwitch);
        if (started) markSwitchPlaying();
    } catch (error) {
        markSwitchFailed(error);
    }
    
    if (playerStoreActions.onSongSwitch) playerStoreActions.onSongSwitch(song.id);
    startAnimationLoop();
  },

  switchByDirection: async (direction: TrackDirection) => {
      const actionRequestId = ++trackActionRequestId;
      const { currentSongId, playlist, playMode, nextTrack, prevTrack } = usePlayerStore.getState();
      if (!currentSongId) return false;

      const preparedTarget = direction === 'next' ? nextTrack : prevTrack;
      if (preparedTarget?.media_url && preparedTarget.id !== currentSongId) {
          await playerStoreActions.switchTrack(preparedTarget);
          return true;
      }

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

  play: (options: PlayOptions = {}) => {
      if (mediaElement) {
          setPlaybackIntent(true);
          if (mediaElement === globalAudioInstance) ensureGlobalAudioAttached();
          const shouldForceRecovery =
              options.forcePipelineReset ||
              (isIOSWebKit() && isDocumentHidden()) ||
              (isIOSWebKit() && needsPipelineResetAfterMediaSessionPause);

          if (shouldForceRecovery) {
              recoverPlaybackAfterForeground(options.reason || 'play', true).then((started) => {
                  if (!started) {
                      throw new Error('Forced playback recovery did not start playback.');
                  }
              }).catch(e => {
                  console.error("Play error", e);
                  setPlaybackIntent(false);
                  usePlayerStore.setState({ isPlaying: false });
                  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
              });
              return;
          }

          const playPromise = mediaElement.play();
          if (playPromise !== undefined) {
              playPromise.catch(e => {
                  console.error("Play error", e);
                  setPlaybackIntent(false);
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
  pause: (options: PauseOptions = {}) => {
      if (options.fromMediaSession) {
          needsPipelineResetAfterMediaSessionPause = true;
      }
      setPlaybackIntent(false);
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

initPlaybackLifecycleHandlers();

export default usePlayerStore;
