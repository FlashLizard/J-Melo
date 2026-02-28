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
let isSeeking = false; // Add a flag to block rAF updates during seek

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
    
    // Do not update from mediaElement if we are in the middle of a seek operation,
    // to avoid Safari reporting old/wrong times while buffering.
    if (!isSeeking) {
        const { loopA, loopB, isPlaying } = usePlayerStore.getState();
        const newTime = mediaElement.currentTime;

        // Check for looping
        if (loopA !== null && loopB !== null && newTime >= loopB) {
            mediaElement.currentTime = loopA;
            usePlayerStore.setState({ currentTime: loopA });
        } else {
            usePlayerStore.setState({ currentTime: newTime });
        }
    }

    // Always keep the loop running if we are supposed to be playing
    if (usePlayerStore.getState().isPlaying) {
        rafId = requestAnimationFrame(updateTimeLoop);
    }
};

const handleLoadedMetadata = () => mediaElement && usePlayerStore.setState({ duration: mediaElement.duration });
const handlePlay = () => {
    usePlayerStore.setState({ isPlaying: true });
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updateTimeLoop);
};
const handlePause = () => {
    usePlayerStore.setState({ isPlaying: false });
    if (rafId) cancelAnimationFrame(rafId);
    if (mediaElement && !isSeeking) usePlayerStore.setState({ currentTime: mediaElement.currentTime });
};
const handleEnded = () => {
    usePlayerStore.setState({ isPlaying: false, hasEnded: true });
    if (rafId) cancelAnimationFrame(rafId);
};
const handleSeeking = () => {
    isSeeking = true;
};
const handleSeeked = () => {
    isSeeking = false;
    if (mediaElement) usePlayerStore.setState({ currentTime: mediaElement.currentTime });
};

export const playerStoreActions = {
  setMediaElement: (element: HTMLAudioElement | HTMLVideoElement | null) => {
    console.log("playerStoreActions.setMediaElement called with:", element);
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
    // Keep playbackRate and playMode but reset other playback state
    usePlayerStore.setState({ isPlaying: false, currentTime: 0, duration: 0, hasEnded: false });
    if (element) {
        element.playbackRate = usePlayerStore.getState().playbackRate; // Apply current rate to new element
        element.addEventListener('loadedmetadata', handleLoadedMetadata);
        element.addEventListener('play', handlePlay);
        element.addEventListener('pause', handlePause);
        element.addEventListener('ended', handleEnded);
        element.addEventListener('seeking', handleSeeking);
        element.addEventListener('seeked', handleSeeked);
        if (!element.paused) {
            handlePlay();
        }
    }
  },
  play: () => {
    mediaElement?.play();
  },
  pause: () => {
    mediaElement?.pause();
  },
  togglePlay: () => {
    const { isPlaying } = usePlayerStore.getState();
    if (isPlaying) {
      mediaElement?.pause();
    } else {
      mediaElement?.play();
    }
  },
  setPlaybackRate: (rate: number) => {
    if (mediaElement) {
        mediaElement.playbackRate = rate;
    }
    usePlayerStore.setState({ playbackRate: rate });
  },
  seek: (time: number) => { 
    if (mediaElement) {
        isSeeking = true; // Instantly lock updates
        mediaElement.currentTime = time; 
        usePlayerStore.setState({ currentTime: time }); // Optimistic UI update
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
