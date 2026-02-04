// src/stores/useMobileViewStore.ts
import { create } from 'zustand';

type MobileView = 'player' | 'lyrics' | 'tools';

interface MobileViewState {
  activeView: MobileView;
  setActiveView: (view: MobileView) => void;
  goToNextView: () => void;
  goToPrevView: () => void;
}

const views: MobileView[] = ['player', 'lyrics', 'tools'];

const useMobileViewStore = create<MobileViewState>((set) => ({
  activeView: 'lyrics', // Default to the lyrics view on mobile
  setActiveView: (view) => set({ activeView: view }),
  goToNextView: () => set(state => {
    const currentIndex = views.indexOf(state.activeView);
    const nextIndex = (currentIndex + 1) % views.length;
    return { activeView: views[nextIndex] };
  }),
  goToPrevView: () => set(state => {
    const currentIndex = views.indexOf(state.activeView);
    const nextIndex = (currentIndex - 1 + views.length) % views.length;
    return { activeView: views[nextIndex] };
  }),
}));

export default useMobileViewStore;
