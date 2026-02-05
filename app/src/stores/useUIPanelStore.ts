// src/stores/useUIPanelStore.ts
import { create } from 'zustand';

export type PanelType = 'AI_TUTOR' | 'SENTENCE_EDITOR' | 'AI_CORRECTOR' | 'TOOL_PANEL' | 'FULL_LYRICS_EDITOR' | 'SONG_INFO_EDITOR' | 'LYRIC_TRANSLATION_PANEL';

interface UIPanelState {
  activePanel: PanelType;
  setActivePanel: (panel: PanelType) => void;
}

const useUIPanelStore = create<UIPanelState>((set) => ({
  activePanel: 'TOOL_PANEL', // Default to the new tool panel
  setActivePanel: (panel) => set({ activePanel: panel }),
}));

export default useUIPanelStore;
