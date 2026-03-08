// src/stores/usePlayerStore.ts
import { create } from 'zustand';
import { db } from '@/lib/db';
import useSettingsStore from './useSettingsStore';

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

// Singleton Audio for iOS stability
let globalAudioInstance: HTMLAudioElement | null = null;
if (typeof window !== 'undefined') {
    globalAudioInstance = new Audio();
    globalAudioInstance.preload = 'auto';
    globalAudioInstance.setAttribute('playsinline', 'true');
    globalAudioInstance.setAttribute('webkit-playsinline', 'true');
    globalAudioInstance.crossOrigin = 'anonymous';
    globalAudioInstance.style.display = 'none';
    
    const attach = () => {
        if (document.body && globalAudioInstance && !globalAudioInstance.parentElement) {
            document.body.appendChild(globalAudioInstance);
            document.removeEventListener('click', attach);
            document.removeEventListener('touchstart', attach);
        }
    };
    document.addEventListener('click', attach);
    document.addEventListener('touchstart', attach);
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
    console.log("PlayerStore: Audio started playing");
    usePlayerStore.setState({ isPlaying: true, hasEnded: false });
    startAnimationLoop();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    syncPositionState();
};

const handlePause = () => {
    if (isSwitchingSource) return;
    console.log("PlayerStore: Audio paused");
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
    console.log("PlayerStore: Audio ended");
    const { playMode, nextTrack } = usePlayerStore.getState();
    if (playMode === 'loop-single') {
        playerStoreActions.seek(0);
        playerStoreActions.play();
        return;
    }
    if (nextTrack) {
        playerStoreActions.switchTrack(nextTrack);
    } else {
        usePlayerStore.setState({ isPlaying: false, hasEnded: true });
    }
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

const blobUrls = new Set<string>();
const createSafeBlobUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    blobUrls.add(url);
    return url;
};

export const playerStoreActions = {
  onSongSwitch: null as ((id: number) => void) | null,

  getGlobalAudio: () => globalAudioInstance,

  setMediaElement: (element: HTMLAudioElement | HTMLVideoElement | null) => {
    if (mediaElement === element) return;
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
    const { playlist, playMode } = usePlayerStore.getState();
    if (playlist.length === 0) return;

    const findNeighborId = (direction: 'next' | 'prev'): number | null => {
        const currentIndex = playlist.indexOf(currentId);
        if (currentIndex === -1) return null;
        if (playMode === 'shuffle' && playlist.length > 1) {
            let randomIndex;
            do { randomIndex = Math.floor(Math.random() * playlist.length); } 
            while (playlist[randomIndex] === currentId || (playlist.length > 1 && randomIndex === currentIndex));
            return playlist[randomIndex];
        }
        if (direction === 'next') return playlist[(currentIndex + 1) % playlist.length];
        return playlist[(currentIndex - 1 + playlist.length) % playlist.length];
    };

    const nextId = findNeighborId('next');
    const prevId = findNeighborId('prev');

    const fetchMetadata = async (id: number | null): Promise<PlaylistItem | null> => {
        if (id === null) return null;
        const song = await db.songs.get(id);
        if (!song) return null;
        const backendUrl = useSettingsStore.getState().settings.backendUrl;
        let mUrl = song.media_url ? `${backendUrl}${song.media_url}` : null;
        if (song.audioData) mUrl = createSafeBlobUrl(song.audioData);
        let cUrl = song.cover_url;
        if (song.coverImageData) cUrl = createSafeBlobUrl(song.coverImageData);
        return { id, title: song.title, artist: song.artist, cover_url: cUrl || '', media_url: mUrl };
    };

    const [next, prev] = await Promise.all([fetchMetadata(nextId), fetchMetadata(prevId)]);
    usePlayerStore.setState({ nextTrack: next, prevTrack: prev });
  },

  switchTrack: (song: PlaylistItem) => {
    if (!mediaElement || !song.media_url) return;
    
    isSwitchingSource = true;
    usePlayerStore.setState({ 
        currentSongId: song.id, 
        hasEnded: false, 
        isPlaying: true, 
        currentTime: 0,
        duration: 0 
    });
    
    const absoluteTargetUrl = new URL(song.media_url, window.location.href).href;
    if (mediaElement.src !== absoluteTargetUrl) {
        mediaElement.src = song.media_url;
        mediaElement.load();
    }
    
    mediaElement.muted = false;
    mediaElement.volume = 1.0;
    
    const playPromise = mediaElement.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            isSwitchingSource = false;
            syncPositionState();
        }).catch(e => {
            console.error("Switch play failed", e);
            isSwitchingSource = false;
        });
    } else {
        isSwitchingSource = false;
    }
    
    playerStoreActions.updateMetadata(song.title, song.artist || 'Unknown', song.cover_url || '');
    playerStoreActions.prepareNeighbors(song.id);
    
    if (playerStoreActions.onSongSwitch) playerStoreActions.onSongSwitch(song.id);
    startAnimationLoop();
  },

  onNextTrack: () => {
      const { nextTrack } = usePlayerStore.getState();
      if (nextTrack) playerStoreActions.switchTrack(nextTrack);
  },
  onPrevTrack: () => {
      const { prevTrack } = usePlayerStore.getState();
      if (prevTrack) playerStoreActions.switchTrack(prevTrack);
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
          mediaElement.play().catch(e => console.error("Play error", e));
          usePlayerStore.setState({ isPlaying: true });
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
