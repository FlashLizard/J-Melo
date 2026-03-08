// src/stores/usePlayerStore.ts
import { create } from 'zustand';

export type PlayMode = 'sequential' | 'shuffle' | 'loop-single';

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopA: number | null;
  loopB: number | null;
  playbackRate: number;
  playMode: PlayMode;
  hasEnded: boolean;
}

let mediaElement: HTMLAudioElement | HTMLVideoElement | null = null;
let rafId: number | null = null;
let isSeeking = false;

const usePlayerStore = create<PlayerState>(() => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  loopA: null,
  loopB: null,
  playbackRate: 1.0,
  playMode: 'sequential',
  hasEnded: false,
}));

const updateTimeLoop = () => {
    if (!mediaElement) return;
    if (!isSeeking) {
        const { loopA, loopB } = usePlayerStore.getState();
        const newTime = mediaElement.currentTime;
        if (loopA !== null && loopB !== null && newTime >= loopB) {
            mediaElement.currentTime = loopA;
            usePlayerStore.setState({ currentTime: loopA });
        } else {
            usePlayerStore.setState({ currentTime: newTime });
        }
    }
    if (usePlayerStore.getState().isPlaying) {
        rafId = requestAnimationFrame(updateTimeLoop);
    }
};

const handleLoadedMetadata = () => {
    if (mediaElement) {
        usePlayerStore.setState({ duration: mediaElement.duration });
        if ('mediaSession' in navigator && mediaElement.duration) {
            navigator.mediaSession.setPositionState({
                duration: mediaElement.duration,
                playbackRate: mediaElement.playbackRate,
                position: mediaElement.currentTime
            });
        }
    }
};

const handlePlay = () => {
    usePlayerStore.setState({ isPlaying: true });
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updateTimeLoop);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
};

const handlePause = () => {
    usePlayerStore.setState({ isPlaying: false });
    if (rafId) cancelAnimationFrame(rafId);
    if (mediaElement && !isSeeking) usePlayerStore.setState({ currentTime: mediaElement.currentTime });
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
};

const handleEnded = () => {
    usePlayerStore.setState({ isPlaying: false, hasEnded: true });
    if (rafId) cancelAnimationFrame(rafId);
    if (playerStoreActions.onTrackEnded) {
        playerStoreActions.onTrackEnded();
    }
};

const handleSeeking = () => { isSeeking = true; };
const handleSeeked = () => {
    isSeeking = false;
    if (mediaElement) {
        usePlayerStore.setState({ currentTime: mediaElement.currentTime });
        if ('mediaSession' in navigator && mediaElement.duration) {
            navigator.mediaSession.setPositionState({
                duration: mediaElement.duration,
                playbackRate: mediaElement.playbackRate,
                position: mediaElement.currentTime
            });
        }
    }
};

export const playerStoreActions = {
  onTrackEnded: null as (() => void) | null,
  onNextTrack: null as (() => void) | null,
  onPrevTrack: null as (() => void) | null,

  setMediaElement: (element: HTMLAudioElement | HTMLVideoElement | null) => {
    if (mediaElement) {
        mediaElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        mediaElement.removeEventListener('play', handlePlay);
        mediaElement.removeEventListener('pause', handlePause);
        mediaElement.removeEventListener('ended', handleEnded);
        mediaElement.removeEventListener('seeking', handleSeeking);
        mediaElement.removeEventListener('seeked', handleSeeked);
        if (rafId) cancelAnimationFrame(rafId);
    }
    mediaElement = element;
    isSeeking = false;
    usePlayerStore.setState({ isPlaying: false, currentTime: 0, duration: 0, hasEnded: false });
    if (element) {
        element.playbackRate = usePlayerStore.getState().playbackRate;
        element.addEventListener('loadedmetadata', handleLoadedMetadata);
        element.addEventListener('play', handlePlay);
        element.addEventListener('pause', handlePause);
        element.addEventListener('ended', handleEnded);
        element.addEventListener('seeking', handleSeeking);
        element.addEventListener('seeked', handleSeeked);
        if (!element.paused) handlePlay();

        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => playerStoreActions.play());
            navigator.mediaSession.setActionHandler('pause', () => playerStoreActions.pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => playerStoreActions.onPrevTrack?.());
            navigator.mediaSession.setActionHandler('nexttrack', () => playerStoreActions.onNextTrack?.());
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) playerStoreActions.seek(details.seekTime);
            });
        }
    }
  },

  updateMetadata: (title: string, artist: string, artworkUrl: string) => {
    if ('mediaSession' in navigator && (window as any).MediaMetadata) {
        navigator.mediaSession.metadata = new (window as any).MediaMetadata({
            title, artist,
            artwork: [{ src: artworkUrl, sizes: '512x512', type: 'image/png' }]
        });
    }
  },

  play: () => { mediaElement?.play().catch(e => console.error("Play failed", e)); },
  pause: () => { mediaElement?.pause(); },
  togglePlay: () => {
    const { isPlaying } = usePlayerStore.getState();
    if (isPlaying) mediaElement?.pause(); else mediaElement?.play().catch(e => console.error("Play failed", e));
  },
  setPlaybackRate: (rate: number) => {
    if (mediaElement) mediaElement.playbackRate = rate;
    usePlayerStore.setState({ playbackRate: rate });
  },
  seek: (time: number) => { 
    if (mediaElement) {
        isSeeking = true;
        mediaElement.currentTime = time; 
        usePlayerStore.setState({ currentTime: time });
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
  },
  clearHasEnded: () => usePlayerStore.setState({ hasEnded: false }),
};

export default usePlayerStore;
