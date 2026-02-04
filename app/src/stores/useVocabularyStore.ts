// src/stores/useVocabularyStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { db, WordRecord, SongRecord } from '@/lib/db';

export type VocabDisplayMode = 'all' | 'bySong' | 'search';

interface VocabularyState {
  words: WordRecord[];
  songs: SongRecord[];
  displayMode: VocabDisplayMode;
  searchQuery: string;
  selectedIds: Set<number>;
  isSelectionMode: boolean;
  
  // Card Viewer State
  isViewerOpen: boolean;
  viewerItems: WordRecord[];
  currentViewerIndex: number;

  // Actions
  loadWordsAndSongs: () => Promise<void>;
  setDisplayMode: (mode: VocabDisplayMode) => void;
  setSearchQuery: (query: string) => void;
  toggleSelectionMode: () => void;
  toggleIdSelection: (id: number) => void;
  selectBySongId: (songId: number, isSelected: boolean) => void;
  selectAll: () => void;
  deselectAll: () => void;
  deleteSelected: () => Promise<void>;

  // Viewer Actions
  openViewer: (items: WordRecord[], startIndex: number) => void;
  closeViewer: () => void;
  goToNextViewerItem: () => void;
  goToPrevViewerItem: () => void;
  updateViewerItem: (updatedWord: WordRecord) => void;
}

const useVocabularyStore = create<VocabularyState>()(
  devtools(
    immer((set, get) => ({
      words: [],
      songs: [],
      displayMode: 'all',
      searchQuery: '',
      selectedIds: new Set(),
      isSelectionMode: false,
      isViewerOpen: false,
      viewerItems: [],
      currentViewerIndex: 0,

      loadWordsAndSongs: async () => {
        const [words, songs] = await Promise.all([
          db.words.orderBy('createdAt').reverse().toArray(),
          db.songs.toArray(),
        ]);
        set({ words, songs });
      },
      setDisplayMode: (mode) => set({ displayMode: mode, searchQuery: '', selectedIds: new Set() }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      toggleSelectionMode: () => set(state => {
        state.isSelectionMode = !state.isSelectionMode;
        state.selectedIds.clear();
      }),
      toggleIdSelection: (id) => set(state => {
        if (state.selectedIds.has(id)) {
          state.selectedIds.delete(id);
        } else {
          state.selectedIds.add(id);
        }
      }),
      selectBySongId: (songId, isSelected) => set(state => {
        const wordsInSong = state.words.filter(w => w.sourceSongId === songId);
        for (const word of wordsInSong) {
          if (word.id) {
            if (isSelected) state.selectedIds.add(word.id);
            else state.selectedIds.delete(word.id);
          }
        }
      }),
      selectAll: () => set(state => {
        state.words.forEach(word => word.id && state.selectedIds.add(word.id));
      }),
      deselectAll: () => set(state => {
        state.selectedIds.clear();
      }),
      deleteSelected: async () => {
        const idsToDelete = Array.from(get().selectedIds);
        await db.words.bulkDelete(idsToDelete);
        set(state => {
          state.words = state.words.filter(w => !idsToDelete.includes(w.id!));
          state.selectedIds.clear();
          state.isSelectionMode = false;
        });
      },
      openViewer: (items, startIndex) => set({ isViewerOpen: true, viewerItems: items, currentViewerIndex: startIndex }),
      closeViewer: () => set({ isViewerOpen: false, viewerItems: [], currentViewerIndex: 0 }),
      goToNextViewerItem: () => set(state => {
        state.currentViewerIndex = (state.currentViewerIndex + 1) % state.viewerItems.length;
      }),
      goToPrevViewerItem: () => set(state => {
        state.currentViewerIndex = (state.currentViewerIndex - 1 + state.viewerItems.length) % state.viewerItems.length;
      }),
      updateViewerItem: (updatedWord) => set(state => {
        const wordIndexInViewer = state.viewerItems.findIndex(w => w.id === updatedWord.id);
        if (wordIndexInViewer !== -1) {
          state.viewerItems[wordIndexInViewer] = updatedWord;
        }
        const wordIndexInAll = state.words.findIndex(w => w.id === updatedWord.id);
        if (wordIndexInAll !== -1) {
          state.words[wordIndexInAll] = updatedWord;
        }
      }),
    })),
    { name: 'VocabularyStore' }
  )
);

export default useVocabularyStore;
