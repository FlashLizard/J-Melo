// src/stores/usePlayerStore.ts
import { create } from 'zustand';

interface PlayerState {
  mediaElement: HTMLAudioElement | HTMLVideoElement | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopA: number | null;
  loopB: number | null;
  actions: {
    setMediaElement: (element: HTMLAudioElement | HTMLVideoElement | null) => void;
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;
    togglePlay: () => void;
    setLoopA: () => void;
    setLoopB: () => void;
    clearLoop: () => void;
  };
}

const usePlayerStore = create<PlayerState>((set, get) => {
  const handlers = {
    handleTimeUpdate: () => {
      const { mediaElement, loopA, loopB } = get();
      if (mediaElement) {
        const newTime = mediaElement.currentTime;
        if (loopA !== null && loopB !== null && newTime >= loopB) {
          mediaElement.currentTime = loopA;
          set({ currentTime: loopA });
        } else {
          set({ currentTime: newTime });
        }
      }
    },
    handleLoadedMetadata: () => {
      const { mediaElement } = get();
      if (mediaElement) {
        set({ duration: mediaElement.duration });
      }
    },
    handlePlay: () => set({ isPlaying: true }),
    handlePause: () => set({ isPlaying: false }),
    handleEnded: () => set({ isPlaying: false }),
  };

  return {
    mediaElement: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    loopA: null,
    loopB: null,
    actions: {
      setMediaElement: (element) => {
        const { mediaElement } = get();
        if (mediaElement) {
          mediaElement.removeEventListener('timeupdate', handlers.handleTimeUpdate);
          mediaElement.removeEventListener('loadedmetadata', handlers.handleLoadedMetadata);
          mediaElement.removeEventListener('play', handlers.handlePlay);
          mediaElement.removeEventListener('pause', handlers.handlePause);
          mediaElement.removeEventListener('ended', handlers.handleEnded);
        }

        set({ mediaElement: element, isPlaying: false, currentTime: 0, duration: 0 });

        if (element) {
          element.addEventListener('timeupdate', handlers.handleTimeUpdate);
          element.addEventListener('loadedmetadata', handlers.handleLoadedMetadata);
          element.addEventListener('play', handlers.handlePlay);
          element.addEventListener('pause', handlers.handlePause);
          element.addEventListener('ended', handlers.handleEnded);
        }
      },
      play: () => {
        get().mediaElement?.play();
      },
      pause: () => {
        get().mediaElement?.pause();
      },
      togglePlay: () => {
        const { isPlaying, mediaElement } = get();
        if (!mediaElement) return;
        if (isPlaying) {
          mediaElement.pause();
        } else {
          mediaElement.play();
        }
      },
      seek: (time) => {
        const { mediaElement } = get();
        if (mediaElement) {
          mediaElement.currentTime = time;
        }
      },
      setLoopA: () => {
        const { currentTime } = get();
        set({ loopA: currentTime, loopB: null }); // Reset B when A is set
      },
      setLoopB: () => {
        const { currentTime, loopA } = get();
        if (loopA !== null && currentTime > loopA) {
          set({ loopB: currentTime });
        }
      },
      clearLoop: () => {
        set({ loopA: null, loopB: null });
      },
    },
  };
});

export default usePlayerStore;
