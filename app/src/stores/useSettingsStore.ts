// src/stores/useSettingsStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { db, Settings } from '@/lib/db';

interface SettingsState {
  settings: Settings; // No longer Partial, will be fully initialized
  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  toggleShowReadings: () => Promise<void>;
  toggleShowTranslations: () => Promise<void>;
}

const DEFAULT_SETTINGS: Settings = {
  id: 0,
  openaiApiKey: null,
  llmApiUrl: null,
  llmModelType: null,
  aiResponseLanguage: 'en',
  uiLanguage: 'en',
  showReadings: true, // Default to true
  showTranslations: true, // Default to true
  translationLLMApiKey: null,
  translationLLMApiUrl: null,
  translationLLMModelType: null,
  targetTranslationLanguage: 'en', // Default target language
  backendUrl: 'http://localhost:8000', // New: Default backend URL
};

const useSettingsStore = create<SettingsState>()(
  devtools(
    immer((set, get) => ({
      settings: DEFAULT_SETTINGS, // Initialize with defaults
      loadSettings: async () => {
        const storedSettings = await db.settings.get(0);
        let configBackendUrl = null;
        try {
          const response = await fetch('/config.json.example');
          if (response.ok) {
            const config = await response.json();
            configBackendUrl = config.backendUrl;
          }
        } catch (error) {
          console.warn("Failed to load config.json.example, using default backend URL.", error);
        }
        set(state => {
          // Merge stored settings with defaults, then apply configBackendUrl if no stored value
          state.settings = { ...DEFAULT_SETTINGS, ...storedSettings };
          if (!state.settings.backendUrl && configBackendUrl) {
            state.settings.backendUrl = configBackendUrl;
          } else if (state.settings.backendUrl === 'http://localhost:8000' && configBackendUrl) {
            // If the stored backendUrl is still the hardcoded default, and a configBackendUrl exists, use the config one
            state.settings.backendUrl = configBackendUrl;
          }
        });
      },
      updateSetting: async (key, value) => {
        set((state) => {
          (state.settings as any)[key] = value; // Type assertion needed due to dynamic key
        });
        const currentSettings = get().settings;
        await db.settings.put({ ...currentSettings, id: 0 });
      },
      toggleShowReadings: async () => {
        set(state => { state.settings.showReadings = !state.settings.showReadings; });
        const currentSettings = get().settings;
        await db.settings.put({ ...currentSettings, id: 0 });
      },
      toggleShowTranslations: async () => {
        set(state => { state.settings.showTranslations = !state.settings.showTranslations; });
        const currentSettings = get().settings;
        await db.settings.put({ ...currentSettings, id: 0 });
      },
    })),
    { name: 'SettingsStore' }
  )
);

export default useSettingsStore;