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
  setLyricsFontSize: (size: number) => Promise<void>;
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
  translationLLMMaxTokens: 32768,
  targetTranslationLanguage: 'en', // Default target language
  backendUrl: 'http://localhost:8000', // New: Default backend URL
  llmMaxTokens: 32768,
  lyricFixLLMMaxTokens: 32768,
  sharerNickname: '', // New: default sharer nickname
  defaultHomepage: 'library', // Default homepage
  themeMode: 'dark', // Default theme
};

const useSettingsStore = create<SettingsState>()(
  devtools(
    immer((set, get) => ({
      settings: DEFAULT_SETTINGS, // Initialize with defaults
      loadSettings: async () => {
        // Priority for backendUrl: 1. User Saved (in DB), 2. config.json, 3. Hardcoded fallback
        let deploymentDefaultUrl = 'http://localhost:8000'; // 3. Hardcoded fallback
        try {
          const response = await fetch('/config.json'); // Correctly fetch config.json
          if (response.ok) {
            const config = await response.json();
            if (config.backendUrl) {
              deploymentDefaultUrl = config.backendUrl; // 2. config.json overrides fallback
            }
          }
        } catch (error) {
          // It's okay if config.json is not found, we'll use the hardcoded default.
          console.info("'/config.json' not found. Using hardcoded default backend URL.");
        }

        const storedSettings = await db.settings.get(0);

        set(state => {
          // Establish the final default settings, with backendUrl determined by the logic above.
          const finalDefaultSettings = { ...DEFAULT_SETTINGS, backendUrl: deploymentDefaultUrl };
          
          // User's stored settings (from DB) override any defaults.
          state.settings = { ...finalDefaultSettings, ...storedSettings };
          
          // Apply theme mode on load
          if (typeof document !== 'undefined') {
              if (state.settings.themeMode === 'light') {
                  document.documentElement.classList.add('light-mode');
              } else {
                  document.documentElement.classList.remove('light-mode');
              }
          }
        });
      },
      updateSetting: async (key, value) => {
        set((state) => {
          (state.settings as any)[key] = value; // Type assertion needed due to dynamic key
          
          // Apply theme mode instantly
          if (key === 'themeMode' && typeof document !== 'undefined') {
              if (value === 'light') {
                  document.documentElement.classList.add('light-mode');
              } else {
                  document.documentElement.classList.remove('light-mode');
              }
          }
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
      setLyricsFontSize: async (size: number) => {
        set(state => { state.settings.lyricsFontSize = size; });
        const currentSettings = get().settings;
        await db.settings.put({ ...currentSettings, id: 0 });
      },
    })),
    { name: 'SettingsStore' }
  )
);

export default useSettingsStore;
