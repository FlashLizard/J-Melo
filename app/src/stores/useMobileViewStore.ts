// src/stores/useMobileViewStore.ts
import { create } from 'zustand';

type MobileView = 'player' | 'lyrics' | 'tools';

export const MOBILE_VIEWS: MobileView[] = ['player', 'lyrics', 'tools'];

interface MobileViewState {
  activeView: MobileView;
  dragOffset: number; // Current horizontal displacement in pixels
  isSwipeDisabled: boolean;
  setActiveView: (view: MobileView) => void;
  setDragOffset: (offset: number) => void;
  goToNextView: () => void;
  goToPrevView: () => void;
  setSwipeDisabled: (disabled: boolean) => void;
}

const useMobileViewStore = create<MobileViewState>((set) => ({
  activeView: 'player', // Changed from 'lyrics' to 'player' as default
  dragOffset: 0,
  isSwipeDisabled: false,
  setActiveView: (view) => set({ activeView: view, dragOffset: 0 }),
  setDragOffset: (offset) => set({ dragOffset: offset }),
  setSwipeDisabled: (disabled) => set({ isSwipeDisabled: disabled }),
  goToNextView: () => set(state => {
    const currentIndex = MOBILE_VIEWS.indexOf(state.activeView);
    if (currentIndex < MOBILE_VIEWS.length - 1) {
        return { activeView: MOBILE_VIEWS[currentIndex + 1], dragOffset: 0 };
    }
    return { dragOffset: 0 };
  }),
  goToPrevView: () => set(state => {
    const currentIndex = MOBILE_VIEWS.indexOf(state.activeView);
    if (currentIndex > 0) {
        return { activeView: MOBILE_VIEWS[currentIndex - 1], dragOffset: 0 };
    }
    return { dragOffset: 0 };
  }),
}));

export default useMobileViewStore;
