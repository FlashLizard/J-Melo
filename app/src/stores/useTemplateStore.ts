// src/stores/useTemplateStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { db, PromptTemplate, CardTemplate } from '@/lib/db';
import useSettingsStore from './useSettingsStore';

interface TemplateState {
  promptTemplates: PromptTemplate[];
  cardTemplates: CardTemplate[];
  
  // Prompt Template Actions
  loadPromptTemplates: () => Promise<void>;
  addPromptTemplate: (name: string, content: string) => Promise<void>;
  updatePromptTemplate: (id: number, content: string) => Promise<void>;
  deletePromptTemplate: (id: number) => Promise<void>;
  
  // Card Template Actions
  loadCardTemplates: () => Promise<void>;
  addCardTemplate: (name: string, front: string, back: string) => Promise<void>;
  updateCardTemplate: (id: number, front: string, back: string) => Promise<void>;
  deleteCardTemplate: (id: number) => Promise<void>;
}

const useTemplateStore = create<TemplateState>()(
  devtools(
    immer((set, get) => ({
      promptTemplates: [],
      cardTemplates: [],

      loadPromptTemplates: async () => {
        const templates = await db.promptTemplates.toArray();
        set({ promptTemplates: templates });
      },
      addPromptTemplate: async (name, content) => {
        const newTemplate: PromptTemplate = { name, content, createdAt: new Date() };
        const id = await db.promptTemplates.add(newTemplate);
        set((state) => {
          state.promptTemplates.push({ ...newTemplate, id });
        });
      },
      updatePromptTemplate: async (id, content) => {
        await db.promptTemplates.update(id, { content });
        set((state) => {
          const index = state.promptTemplates.findIndex(t => t.id === id);
          if (index !== -1) state.promptTemplates[index].content = content;
        });
      },
      deletePromptTemplate: async (id) => {
        await db.promptTemplates.delete(id);
        set((state) => {
          state.promptTemplates = state.promptTemplates.filter(t => t.id !== id);
        });
        // If the deleted template was the default, unset it
        if (useSettingsStore.getState().settings.defaultPromptTemplateId === id) {
          useSettingsStore.getState().updateSetting('defaultPromptTemplateId', undefined);
        }
      },

      loadCardTemplates: async () => {
        const templates = await db.cardTemplates.toArray();
        set({ cardTemplates: templates });
      },
      addCardTemplate: async (name, front, back) => {
        const newTemplate: CardTemplate = { name, front, back, createdAt: new Date() };
        const id = await db.cardTemplates.add(newTemplate);
        set((state) => {
          state.cardTemplates.push({ ...newTemplate, id });
        });
      },
      updateCardTemplate: async (id, front, back) => {
        await db.cardTemplates.update(id, { front, back });
        set((state) => {
          const index = state.cardTemplates.findIndex(t => t.id === id);
          if (index !== -1) {
            state.cardTemplates[index].front = front;
            state.cardTemplates[index].back = back;
          }
        });
      },
      deleteCardTemplate: async (id) => {
        await db.cardTemplates.delete(id);
        set((state) => {
          state.cardTemplates = state.cardTemplates.filter(t => t.id !== id);
        });
         // If the deleted template was the default, unset it
        if (useSettingsStore.getState().settings.defaultCardTemplateId === id) {
          useSettingsStore.getState().updateSetting('defaultCardTemplateId', undefined);
        }
      },
    })),
    { name: 'TemplateStore' }
  )
);

// Initial default templates
(async () => {
    const promptTemplateCount = await db.promptTemplates.count();
    if (promptTemplateCount === 0) {
        console.log('Initializing default prompt template...');
        const defaultPrompt = `请用中文解释一下日语单词“{word}”在句子“{sentence}”中的意思，并简单分析一下它的用法。请将回复限制在50字以内。`;
        await db.promptTemplates.add({ name: '默认解释模板', content: defaultPrompt, createdAt: new Date() });
    }

    const cardTemplateCount = await db.cardTemplates.count();
    if (cardTemplateCount === 0) {
        console.log('Initializing default card template...');
        const defaultCardFront = `{sentence}

**{word}**`;
        const defaultCardBack = `{reading}

---

{llm_response}`;
        await db.cardTemplates.add({ name: '默认卡片模板', front: defaultCardFront, back: defaultCardBack, createdAt: new Date() });
    }
})();


export default useTemplateStore;
