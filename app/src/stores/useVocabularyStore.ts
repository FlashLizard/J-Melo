// src/stores/useVocabularyStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { db, WordRecord, SongRecord } from '@/lib/db';

export type VocabDisplayMode = 'all' | 'bySong' | 'search';

const drawWeightedWord = (words: WordRecord[]): { card: WordRecord | null; remainingWords: WordRecord[] } => {
    if (words.length === 0) return { card: null, remainingWords: [] };
  
    const maxProficiency = 5;
    let totalWeight = 0;
    const weightedList = words.map(word => {
        const weight = Math.max(0.1, maxProficiency - word.proficiency); // Ensure at least a small chance
        totalWeight += weight;
        return { word, weight };
    });
  
    let random = Math.random() * totalWeight;
  
    for (let i = 0; i < weightedList.length; i++) {
        random -= weightedList[i].weight;
        if (random <= 0) {
            const selectedCard = weightedList[i].word;
            const remainingWords = words.filter(w => w.id !== selectedCard.id);
            return { card: selectedCard, remainingWords: remainingWords };
        }
    }
    // Fallback in case of floating point issues (should not happen with maxProficiency > 0)
    const lastWord = words[words.length - 1];
    return { card: lastWord, remainingWords: words.filter(w => w.id !== lastWord.id) };
};

interface VocabularyState {
  words: WordRecord[];
  songs: SongRecord[];
  displayMode: VocabDisplayMode;
  searchQuery: string;
  selectedIds: Set<number>;
  isSelectionMode: boolean;
  isViewerOpen: boolean;
  viewerItems: WordRecord[];
  currentViewerIndex: number;
  isReviewing: boolean;
  reviewWords: WordRecord[];
  currentReviewCard: WordRecord | null;
  
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
  exportSelectedToAnki: (t: (key: string, options?: { [key: string]: any }) => string) => Promise<void>; // New export action, accepts t

  // Viewer Actions
  openViewer: (items: WordRecord[], startIndex: number) => void;
  closeViewer: () => void;
  goToNextViewerItem: () => void;
  goToPrevViewerItem: () => void;
  updateViewerItem: (updatedWord: WordRecord) => void;
  
  // Review Actions
  startReview: (wordsToReview: WordRecord[]) => void;
  endReview: () => void;
  drawNextCard: () => void;
  updateProficiency: (wordId: number, change: number) => Promise<void>;
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
      isReviewing: false,
      reviewWords: [],
      currentReviewCard: null,

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
        if (state.selectedIds.has(id)) state.selectedIds.delete(id);
        else state.selectedIds.add(id);
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
      deselectAll: () => set(state => { state.selectedIds.clear(); }),
      deleteSelected: async () => {
        const idsToDelete = Array.from(get().selectedIds);
        await db.words.bulkDelete(idsToDelete);
        set(state => {
          state.words = state.words.filter(w => !idsToDelete.includes(w.id!));
          state.selectedIds.clear();
          state.isSelectionMode = false;
        });
      },
      exportSelectedToAnki: async (t) => { // Accept t here
        const { selectedIds, words, songs } = get();
        if (selectedIds.size === 0) {
          alert(t("vocabularyPage.noWordsSelectedAlert"));
          return;
        }

        const selectedWords = words.filter(word => selectedIds.has(word.id!));
        const songMap = new Map<number, SongRecord>();
        songs.forEach(song => songMap.set(song.id!, song));

        const csvRows: string[] = [];
        csvRows.push(`"Front","Back","Tags"`); // Anki CSV header

        selectedWords.forEach(word => {
          const song = songMap.get(word.sourceSongId);
          const songTitleTag = song?.title ? `song:${song.title.replace(/,/g, '')}` : ''; // Remove commas from title for tag
          
          // Basic CSV escaping: wrap fields in double quotes, double internal double quotes
          const escapeCsvField = (field: string) => `"${field.replace(/"/g, '""')}"`;

          const front = escapeCsvField(word.cardFront);
          const back = escapeCsvField(word.cardBack);
          const tags = escapeCsvField(songTitleTag);
          
          csvRows.push(`${front},${back},${tags}`);
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'anki_vocabulary.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert(t('vocabularyPage.exportSuccessAlert', { count: selectedIds.size }));
      },
      openViewer: (items, startIndex) => set({ isViewerOpen: true, viewerItems: items, currentViewerIndex: startIndex }),
      closeViewer: () => set({ isViewerOpen: false, viewerItems: [], currentViewerIndex: 0 }),
      goToNextViewerItem: () => set(state => { state.currentViewerIndex = (state.currentViewerIndex + 1) % state.viewerItems.length; }),
      goToPrevViewerItem: () => set(state => { state.currentViewerIndex = (state.currentViewerIndex - 1 + state.viewerItems.length) % state.viewerItems.length; }),
      updateViewerItem: (updatedWord) => set(state => {
        db.words.put(updatedWord);
        const wordIndexInViewer = state.viewerItems.findIndex(w => w.id === updatedWord.id);
        if (wordIndexInViewer !== -1) state.viewerItems[wordIndexInViewer] = updatedWord;
        const wordIndexInAll = state.words.findIndex(w => w.id === updatedWord.id);
        if (wordIndexInAll !== -1) state.words[wordIndexInAll] = updatedWord;
      }),
      startReview: (wordsToReview) => {
        set({ isReviewing: true, reviewWords: [...wordsToReview] }); // Create a copy
        get().drawNextCard();
      },
      endReview: () => set({ isReviewing: false, reviewWords: [], currentReviewCard: null }),
      drawNextCard: () => {
        const { card, remainingWords } = drawWeightedWord(get().reviewWords);
        set({ currentReviewCard: card, reviewWords: remainingWords });
      },
      updateProficiency: async (wordId, change) => {
        const word = get().words.find(w => w.id === wordId);
        if (!word) return;
        
        // Calculate new proficiency
        let newProficiency = word.proficiency + change;
        if (change === -10) newProficiency = -2; // "Lowest"
        if (change === 10) newProficiency = 2;   // "Highest"
        
        // Ensure proficiency stays within a reasonable range, e.g., -2 to 5
        newProficiency = Math.max(-2, Math.min(5, newProficiency));

        // Update in database
        await db.words.update(wordId, { proficiency: newProficiency });
        
        // Update in all relevant local state arrays
        set(state => {
          const wordToUpdateAll = state.words.find(w => w.id === wordId);
          if(wordToUpdateAll) wordToUpdateAll.proficiency = newProficiency;
          
          const wordToUpdateReview = state.reviewWords.find(w => w.id === wordId);
          if(wordToUpdateReview) wordToUpdateReview.proficiency = newProficiency;

          const wordToUpdateViewer = state.viewerItems.find(w => w.id === wordId);
          if(wordToUpdateViewer) wordToUpdateViewer.proficiency = newProficiency;
        });
      },
    })),
    { name: 'VocabularyStore' }
  )
);

export default useVocabularyStore;