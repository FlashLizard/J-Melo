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

const usePlayerStore = create<PlayerState>(() => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  loopA: null,
  loopB: null,
}));

const updateTimeLoop = () => {
    if (!mediaElement) return;
    
    const { loopA, loopB, isPlaying } = usePlayerStore.getState();
    const newTime = mediaElement.currentTime;

    // Check for looping
    if (loopA !== null && loopB !== null && newTime >= loopB) {
        mediaElement.currentTime = loopA;
        usePlayerStore.setState({ currentTime: loopA });
    } else {
        usePlayerStore.setState({ currentTime: newTime });
    }

    if (isPlaying) {
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
    // Force one last update on pause to ensure absolute precision
    if (mediaElement) usePlayerStore.setState({ currentTime: mediaElement.currentTime });
};
const handleEnded = () => {
    usePlayerStore.setState({ isPlaying: false });
    if (rafId) cancelAnimationFrame(rafId);
};
const handleSeeked = () => {
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
        mediaElement.removeEventListener('seeked', handleSeeked);
        if (rafId) cancelAnimationFrame(rafId);
    }
    mediaElement = element;
    usePlayerStore.setState({ isPlaying: false, currentTime: 0, duration: 0 });
    if (element) {
        element.addEventListener('loadedmetadata', handleLoadedMetadata);
        element.addEventListener('play', handlePlay);
        element.addEventListener('pause', handlePause);
        element.addEventListener('ended', handleEnded);
        element.addEventListener('seeked', handleSeeked);
        // If element is somehow already playing when attached
        if (!element.paused) {
            handlePlay();
        }
    }
  },
  play: () => {
    console.log("play action. Current mediaElement:", mediaElement);
    mediaElement?.play();
  },
  pause: () => {
    console.log("pause action. Current mediaElement:", mediaElement);
    mediaElement?.pause();
  },
  togglePlay: () => {
    const { isPlaying } = usePlayerStore.getState();
    console.log(`togglePlay action. isPlaying: ${isPlaying}. Current mediaElement:`, mediaElement);
    if (isPlaying) {
      mediaElement?.pause();
    } else {
      mediaElement?.play();
    }
  },
  seek: (time: number) => { 
    if (mediaElement) {
        mediaElement.currentTime = time; 
        usePlayerStore.setState({ currentTime: time }); // Force instant state update
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
