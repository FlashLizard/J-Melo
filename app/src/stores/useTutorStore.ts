// src/stores/useTutorStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { db } from '@/lib/db';
import useSongStore from './useSongStore';
import useUIPanelStore from './useUIPanelStore';
import useTemplateStore from './useTemplateStore';
import useSettingsStore from './useSettingsStore';
import useMobileViewStore from './useMobileViewStore'; // Import mobile view store
import { LyricLine, LyricToken } from '@/interfaces/lyrics';

interface TutorState {
  sentence: string;
  tokens: LyricToken[];
  selectedTokens: LyricToken[];
  explanation: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  startExplanation: (line: LyricLine, token: LyricToken) => void;
  setSelectedTokens: (tokens: LyricToken[]) => void;
  getExplanation: (prompt: string) => Promise<void>;
  setExplanation: (explanation: string) => void;
  addWordToVocabulary: (front: string, back: string) => Promise<void>;
  clearTutor: () => void;
}

const useTutorStore = create<TutorState>()(
  devtools(
    immer((set, get) => ({
      sentence: '',
      tokens: [],
      selectedTokens: [],
      explanation: null,
      isLoading: false,
      error: null,

      startExplanation: (line, token) => {
        set({
          sentence: line.text,
          tokens: line.tokens,
          selectedTokens: [token],
          explanation: null,
          isLoading: false,
          error: null,
        });
        useUIPanelStore.getState().setActivePanel('AI_TUTOR');
        useMobileViewStore.getState().setActiveView('tools'); // Switch to tools view on mobile
      },

      setSelectedTokens: (tokens) => {
        set({ selectedTokens: tokens, explanation: null });
      },

      getExplanation: async (finalPrompt) => {
        if (get().selectedTokens.length === 0) return;

        set({ isLoading: true, error: null, explanation: null });
        
        try {
          const { settings } = useSettingsStore.getState();
          const apiKey = settings.openaiApiKey;
          const apiUrl = settings.llmApiUrl || 'https://api.openai.com/v1/chat/completions';
          const modelType = settings.llmModelType || 'gpt-3.5-turbo';
          
          if (!apiKey) throw new Error('API key is not set in settings.');

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: modelType, messages: [{ role: 'user', content: finalPrompt }], temperature: 0.5, max_tokens: 150 }),
          });

          if (useUIPanelStore.getState().activePanel !== 'AI_TUTOR') return;
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to fetch explanation');
          }

          const result = await response.json();
          const explanation = result.choices[0]?.message?.content;
          set({ explanation, isLoading: false });
        } catch (err) {
          if (useUIPanelStore.getState().activePanel === 'AI_TUTOR') {
            set({ error: (err as Error).message, isLoading: false });
          }
        }
      },

      setExplanation: (explanation) => set({ explanation }),
      
      addWordToVocabulary: async (front, back) => {
        const { selectedTokens } = get();
        const song = useSongStore.getState().song;
        if (!song?.id || selectedTokens.length === 0) return;

        const surface = selectedTokens.map(t => t.surface).join('');
        const reading = selectedTokens.map(t => t.reading).join('');
        const romaji = selectedTokens.map(t => (t as any).romaji || '').join('');

        await db.words.add({
          surface,
          reading,
          romaji,
          cardFront: front,
          cardBack: back,
          sourceSongId: song.id,
          createdAt: new Date(),
          proficiency: 0,
        });
        alert(`"${surface}" added to vocabulary!`);
      },

      clearTutor: () => {
        set({
          sentence: '',
          tokens: [],
          selectedTokens: [],
          explanation: null,
          isLoading: false,
          error: null,
        });
      },
    })),
    { name: 'TutorStore' }
  )
);

export default useTutorStore;
