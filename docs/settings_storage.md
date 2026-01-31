# 模块实现: 个性化与本地存储 (Settings & Storage)

## 1. 目标
建立一个统一的系统来管理应用的所有本地数据，包括用户生成的内容（如歌词、生词）和应用的配置项。所有数据优先存储在用户浏览器中，确保隐私和离线可用性。

## 2. 技术选型
- **核心库**: `Dexie.js` (作为 IndexedDB 的友好封装)
- **状态管理**: `Zustand` (用于在组件间响应式地访问和修改设置)

## 3. 数据模型 (Dexie.js Schema)

我们将创建一个统一的数据库 `JeloDB`，并在其中定义多个表（stores）。

```typescript
// src/db.ts
import Dexie, { Table } from 'dexie';

// 定义数据结构接口
export interface Song {
  id?: number;
  sourceUrl: string;
  title: string;
  artist: string;
  coverUrl: string;
  duration: number;
  lyrics: LyricLine[]; // LyricLine 是之前定义的结构
  createdAt: Date;
}

export interface Word {
  id?: number;
  surface: string;
  reading: string;
  // ... 其他字段见 srs_review.md
  addedAt: Date;
}

export interface Settings {
  id?: number; // 通常只有一条记录
  llmBaseUrl: string;
  llmApiKey: string;
  llmModelName: string;
  showRomaji: boolean;
  showTranslation: boolean;
  fontSize: number;
}

class JeloDB extends Dexie {
  songs!: Table<Song>;
  words!: Table<Word>;
  settings!: Table<Settings>;

  constructor() {
    super('JeloDB');
    this.version(1).stores({
      songs: '++id, sourceUrl, title, artist',
      words: '++id, &[surface+reading], nextReview, addedAt',
      settings: '++id', // 只有一个设置对象
    });
  }
}

export const db = new JeloDB();
```
- **`songs`**: 存储所有处理过的歌曲及其歌词。`sourceUrl` 作为索引以快速查找。
- **`words`**: 存储用户的生词本。`[surface+reading]` 作为复合主键，防止重复添加。
- **`settings`**: 存储所有用户配置，这个表通常只会有一行数据。

## 4. 设置状态管理 (Zustand Store)

创建一个 `useSettingsStore` 来同步 Dexie 中的设置和应用的 UI 状态。

```typescript
// src/stores/useSettingsStore.ts
import create from 'zustand';
import { db, Settings } from '../db';

interface SettingsState extends Settings {
  isLoading: boolean;
  actions: {
    loadSettings: () => Promise<void>;
    updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  };
}

const defaultSettings: Omit<Settings, 'id'> = {
  llmBaseUrl: 'https://api.openai.com/v1',
  llmApiKey: '',
  llmModelName: 'gpt-4-turbo',
  showRomaji: true,
  showTranslation: false,
  fontSize: 16,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,
  isLoading: true,
  actions: {
    async loadSettings() {
      const storedSettings = await db.settings.get(1);
      if (storedSettings) {
        set({ ...storedSettings, isLoading: false });
      } else {
        // 如果是第一次，写入默认值
        await db.settings.put({ id: 1, ...defaultSettings });
        set({ isLoading: false });
      }
    },
    async updateSetting(key, value) {
      const currentSettings = { ...get(), [key]: value };
      await db.settings.update(1, { [key]: value });
      set({ [key]: value });
    },
  },
}));

// 在应用根组件中调用 loadSettings()
// App.tsx
useEffect(() => {
  useSettingsStore.getState().actions.loadSettings();
}, []);
```

## 5. 设置界面
- 创建一个独立的“设置”页面 (`/settings`)。
- **LLM 设置**:
    - 提供三个输入框，分别用于 `Base URL`, `API Key` (类型为 `password` 以隐藏内容), 和 `Model Name`。
    - 输入框的值与 `useSettingsStore` 绑定。当用户输入时，调用 `updateSetting` 更新状态和数据库。
- **显示设置**:
    - 提供两个开关（Toggle），分别用于“显示罗马音”和“显示中文翻译”。
    - 提供一个滑块（Slider）或数字输入框，用于调整“字体大小”。
    - 这些控件同样与 `useSettingsStore` 绑定。

## 6. 数据安全与隐私
- **API Key**: 明确告知用户 API Key **仅存储在他们自己的浏览器中**，不会上传到任何服务器。在输入框旁显示清晰的隐私提示。
- **数据导出/导入**:
    - 提供一个“导出全部数据”的按钮，将 Dexie 数据库的所有内容（歌曲、单词、设置）序列化为 JSON 文件并下载。
    - 提供一个“导入数据”的按钮，允许用户选择之前导出的 JSON 文件来恢复他们的所有数据。这对于更换浏览器或设备非常有用。

## 7. 待办事项
- [ ] 定义所有 Dexie 表的 `interface` 和 `schema`。
- [ ] 创建 `db.ts` 文件并实例化 Dexie。
- [ ] 创建 `useSettingsStore` (Zustand) 并实现 `load` 和 `update` 逻辑。
- [ ] 在应用启动时调用 `loadSettings`。
- [ ] 创建完整的“设置”页面 UI。
- [ ] 将 UI 控件与 Zustand store 双向绑定。
- [ ] 实现数据的导入和导出功能。
- [ ] 在所有需要访问设置的地方（如 AI Tutor, Lyrics Display）使用 `useSettingsStore`。
