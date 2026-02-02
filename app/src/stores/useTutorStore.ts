// src/stores/useTutorStore.ts
import { create } from 'zustand';
import { db } from '@/lib/db';
import useSongStore from './useSongStore';

interface TutorState {
  selectedText: string | null;
  explanation: string | null;
  isLoading: boolean;
  error: string | null;
}

const useTutorStore = create<TutorState>(() => ({
  selectedText: null,
  explanation: null,
  isLoading: false,
  error: null,
}));

export const tutorStoreActions = {
  setSelectedText: async (text: string) => {
    useTutorStore.setState({ selectedText: text, explanation: null, isLoading: true, error: null });
    try {
      const settings = await db.settings.get(0);
      const apiKey = settings?.openaiApiKey;
      const apiUrl = settings?.llmApiUrl || 'https://api.openai.com/v1/chat/completions';
      const modelType = settings?.llmModelType || 'gpt-3.5-turbo';
      const responseLang = settings?.aiResponseLanguage === 'zh' ? 'Chinese' : 'English';
      if (!apiKey) {
        useTutorStore.setState({ error: 'API key is not set. Please configure it in the settings.', isLoading: false });
        return;
      }
      const prompt = `Explain the following Japanese text for a language learner in ${responseLang}. Provide a breakdown of grammar, vocabulary, and context. Keep the explanation concise and clear.\n\nText: "${text}"`;
      const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model: modelType, messages: [{ role: 'user', content: prompt }], temperature: 0.5 }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch explanation');
      }
      const result = await response.json();
      const explanation = result.choices[0]?.message?.content;
      useTutorStore.setState({ explanation, isLoading: false });
    } catch (err) {
      useTutorStore.setState({ error: (err as Error).message, isLoading: false });
    }
  },
  addWordToVocabulary: async () => {
    const { selectedText, explanation } = useTutorStore.getState();
    const { song, lyrics } = useSongStore.getState();
    if (!selectedText || !explanation || !song?.id) return;
    let reading = '', romaji = '';
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
    await db.words.add({
      surface: selectedText,
      reading,
      romaji,
      definition: explanation,
      sourceSongId: song.id,
      createdAt: new Date(),
    });
    alert(`"${selectedText}" added to vocabulary!`);
  },
};

export default useTutorStore;