// src/stores/useUIPanelStore.ts
import { create } from 'zustand';

export type PanelType = 'AI_TUTOR' | 'SENTENCE_EDITOR' | 'AI_CORRECTOR' | 'TOOL_PANEL' | 'FULL_LYRICS_EDITOR' | 'SONG_INFO_EDITOR' | 'LYRIC_TRANSLATION_PANEL' | 'TIMELESS_LYRICS_IMPORTER' | 'LYRICS_ALIGNMENT_PANEL' | 'LYRICS_WIZARD_PANEL' | 'PETIT_LYRICS_IMPORTER';

interface UIPanelState {
  activePanel: PanelType;
  isLyricsWizardOpen: boolean;
  setActivePanel: (panel: PanelType) => void;
  setIsLyricsWizardOpen: (open: boolean) => void;
}

const useUIPanelStore = create<UIPanelState>((set) => ({
  activePanel: 'TOOL_PANEL', // Default to the new tool panel
  isLyricsWizardOpen: false,
  setActivePanel: (panel) => set({ activePanel: panel }),
  setIsLyricsWizardOpen: (open) => set({ isLyricsWizardOpen: open }),
}));

export default useUIPanelStore;
