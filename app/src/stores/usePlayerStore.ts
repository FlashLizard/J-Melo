import { create } from 'zustand';

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopA: number | null;
  loopB: number | null;
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
    usePlayerStore.setState({ isPlaying: false });
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
    usePlayerStore.setState({ isPlaying: false, currentTime: 0, duration: 0 });
    if (element) {
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
};

export default usePlayerStore;
