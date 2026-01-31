// src/stores/useTutorStore.ts
import { create } from 'zustand';
import { db } from '@/lib/db';
import useSongStore from './useSongStore';

interface TutorState {
  selectedText: string | null;
  explanation: string | null;
  isLoading: boolean;
  error: string | null;
  actions: {
    setSelectedText: (text: string) => void;
    fetchExplanation: () => Promise<void>;
    addWordToVocabulary: () => Promise<void>;
  };
}

const useTutorStore = create<TutorState>((set, get) => ({
  selectedText: null,
  explanation: null,
  isLoading: false,
  error: null,
  actions: {
    setSelectedText: (text) => {
      set({ selectedText: text, explanation: null, error: null });
      get().actions.fetchExplanation();
    },
    fetchExplanation: async () => {
      const { selectedText } = get();
      if (!selectedText) return;

      set({ isLoading: true, error: null });

      try {
        const settings = await db.settings.get(0);
        // For development, you can fallback to an environment variable
        const apiKey = settings?.openaiApiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

        if (!apiKey) {
          set({ error: 'OpenAI API key is not set. Please configure it in the settings.', isLoading: false });
          return; // Exit early
        }

        const prompt = `Explain the following Japanese text for a language learner. Provide a breakdown of grammar, vocabulary, and context. Keep the explanation concise and clear.\n\nText: "${selectedText}"`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to fetch explanation from OpenAI');
        }

        const result = await response.json();
        const explanation = result.choices[0]?.message?.content;

        set({ explanation, isLoading: false });

      } catch (err) {
        const error = err as Error;
        console.error("Error fetching explanation:", err);
        set({ error: error.message, isLoading: false });
      }
    },
    addWordToVocabulary: async () => {
        const { selectedText, explanation } = get();
        const { song, lyrics } = useSongStore.getState();

        if (!selectedText || !explanation || !song?.id) {
            console.error("Cannot add word: missing text, explanation, or song ID.");
            return;
        }

        let reading = '';
        let romaji = '';

        if (lyrics) {
            for (const line of lyrics) {
                const foundToken = line.tokens.find(token => token.surface === selectedText);
                if (foundToken) {
                    reading = foundToken.reading;
                    romaji = foundToken.romaji;
                    break;
                }
            }
        }

        try {
            await db.words.add({
                surface: selectedText,
                reading: reading,
                romaji: romaji,
                definition: explanation,
                sourceSongId: song.id,
                createdAt: new Date(),
            });
            alert(`"${selectedText}" added to vocabulary!`);
        } catch (err) {
            console.error("Error adding word to vocabulary:", err);
            alert("Failed to add word to vocabulary.");
        }
    }
  }
}));

export default useTutorStore;
