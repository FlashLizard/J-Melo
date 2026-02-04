// src/stores/useSettingsStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { db, Settings } from '@/lib/db';

interface SettingsState {
  settings: Partial<Settings>;
  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  saveSettings: (newSettings: Partial<Settings>) => Promise<void>;
}

const useSettingsStore = create<SettingsState>()(
  devtools(
    immer((set, get) => ({
      settings: {},
      loadSettings: async () => {
        const storedSettings = await db.settings.get(0);
        if (storedSettings) {
          set({ settings: storedSettings });
        }
      },
      updateSetting: async (key, value) => {
        set((state) => {
          state.settings[key] = value;
        });
        const currentSettings = get().settings;
        await db.settings.put({ ...currentSettings, id: 0 });
      },
      saveSettings: async (newSettings) => {
        const currentSettings = get().settings;
        const updatedSettings = { ...currentSettings, ...newSettings, id: 0 };
        await db.settings.put(updatedSettings);
        set({ settings: updatedSettings });
      },
    })),
    { name: 'SettingsStore' }
  )
);

export default useSettingsStore;
