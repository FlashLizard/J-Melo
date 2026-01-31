# 模块实现: 复习与卡片系统 (SRS Review)

## 1. 目标
为用户提供一个简单的间隔重复系统（Spaced Repetition System, SRS），允许他们将歌词中的生词添加到复习列表，并能将这些单词导出为 Anki 卡片包。

## 2. 技术选型
- **数据存储**: `Dexie.js` (IndexedDB)
- **导出格式**: CSV (首选，易于实现) 或 `.apkg` (若有合适的库)
- **AI 辅助**: 使用 LLM 自动为单词生成例句。

## 3. 数据模型 (Dexie.js Schema)

### `words` Table
```typescript
db.version(1).stores({
  // ... other tables
  words: `
    ++id,
    surface,      // 单词原文, e.g., "私"
    reading,      // 假名, e.g., "わたし"
    romaji,       // 罗马音
    partOfSpeech, // 词性
    definition,   // [可选] 用户添加的或 AI 生成的释义
    exampleSentence, // AI 生成的例句
    sourceSong,   // 来源歌曲标题
    sourceUrl,    // 来源歌曲 URL
    addedAt,      // 添加时间
    lastReviewed, // 上次复习时间
    nextReview,   // 下次复习日期 (用于 SRS 算法)
    easeFactor    // 难度因子 (用于 SRS 算法)
  `
});
```

## 4. 功能实现

### 4.1 添加生词
- 当用户在 `<LyricsDisplay />` 中点击一个单词时，弹出的菜单中应包含“加入生词本”按钮。
- **点击后**:
    1. 检查该单词（以 `surface` 和 `reading` 为联合键）是否已存在于 `words` 表中。
    2. 如果已存在，提示用户“已在生词本中”。
    3. 如果不存在，弹出一个确认框或小表单，允许用户进行微调。
    4. **调用 LLM**: 在后台，可以触发一个 AI 调用，为这个单词生成一个更自然的例句（除了歌词本身之外）。
    5. 将单词数据（包括 `surface`, `reading`, `romaji`, `partOfSpeech`, 来源歌曲信息等）存入 `words` 表。
    6. 初始化 SRS 参数：`lastReviewed = null`, `nextReview = new Date()`, `easeFactor = 2.5`。

### 4.2 生词本界面
- 创建一个独立的页面或侧边栏，用于展示 `words` 表中的所有单词。
- **功能**:
    - 列表展示所有单词。
    - 提供搜索和筛选功能（例如，按来源歌曲、按添加日期筛选）。
    - 允许用户编辑或删除单词。

### 4.3 复习功能 (简化版 SRS)
- 在生词本界面提供一个“开始复习”按钮。
- **逻辑**:
    1. 从 `words` 表中查询所有 `nextReview <= new Date()` 的单词。
    2. 随机展示一个单词的正面（`surface`）。
    3. 用户点击“显示答案”后，展示背面信息（`reading`, `romaji`, `exampleSentence` 等）。
    4. 提供 "简单", "一般", "困难" 三个按钮。
    5. 根据用户的选择，使用一个简化的 SM-2 算法更新 `nextReview` 和 `easeFactor`。
        - **简单**: 大幅增加下一次复习的间隔。
        - **一般**: 适度增加间隔。
        - **困难**: 重置间隔，很快需要再次复习。

### 4.4 Anki 导出
- **方案一: CSV 导出 (推荐)**
    - 这是最简单直接的方法，Anki 支持从 CSV 文件导入。
    - 创建一个函数，该函数：
        1. 从 `words` 表中获取所有数据。
        2. 将数据格式化为 CSV 字符串。表头应为 `Front`, `Back`, `Example`, `Source` 等。
           ```csv
           "私","わたし (watashi)","これは私のペンです。","歌曲A"
           "食べる","たべる (taberu)","リンゴを食べる。","歌曲B"
           ```
        3. 创建一个 `Blob` 对象，类型为 `text/csv`。
        4. 生成一个临时的 `<a>` 标签，设置 `href` 为 `URL.createObjectURL(blob)`，`download` 属性为 `j-melo-export.csv`，然后模拟点击下载。
- **方案二: `.apkg` 导出 (可选，较复杂)**
    - 需要寻找或开发一个能在浏览器环境中运行的库来生成 `.apkg` 文件。`.apkg` 本质上是一个包含 SQLite 数据库和媒体文件的 zip 压缩包。
    - 这个方案实现难度较高，可以作为长期目标。

## 5. 待办事项
- [ ] 设计并实现 `words` 表的 Dexie.js schema。
- [ ] 在单词的点击菜单中添“加入生词本”功能。
- [ ] 实现添加单词到 IndexedDB 的逻辑。
- [ ] [可选] 集成 LLM 调用以自动生成例句。
- [ ] 创建生词本展示、搜索和管理的 UI。
- [ ] 实现简化的 SRS 复习流程。
- [ ] **重点**: 实现 CSV 导出功能。
- [ ] 研究 `.apkg` 格式和相关 JS 库的可行性。
