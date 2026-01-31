# 项目名称: Japanese Melodic Learning Web App (J-Melo)

## 1. 项目概述
构建一个基于 Web 的日语歌词学习应用。核心功能是用户输入媒体链接（B站/Youtube/网易云），系统自动提取音视频，生成精确到“字”的日语歌词（含注音），并结合大模型提供句子解析、单词卡片制作和复习功能。数据优先存储在用户本地。

## 2. 技术架构
- **Frontend**: React, TypeScript, Tailwind CSS, Zustand, Dexie.js (IndexedDB), Kuroshiro (注音).
- **Backend (BFF)**: FastAPI (Python). 用于处理媒体下载 (yt-dlp)、音频转录 (WhisperX) 和 API 转发.
- **AI**: OpenAI Compatible API (用户自定义 endpoint 和 key).

## 3. 详细功能需求

### 3.1 媒体搜索与获取 (Media Retrieval)
- **输入**: 支持 Bilibili, YouTube, 网易云音乐的 URL 或关键字。
- **处理**:
    - 后端调用 `yt-dlp` 或相关 API 获取媒体流。
    - **关键**: 若为视频，需提取音频轨道用于 Whisper 识别；若只播放音频，需获取封面图。
    - 将媒体资源缓存至本地（IndexedDB 或 本地文件系统），生成本地 Blob URL 供前端播放。

### 3.2 智能歌词系统 (Smart Lyrics System)
- **获取逻辑**:
    1. 优先尝试从源平台获取原生歌词。
    2. 若无，调用后端 WhisperX 模型进行 ASR（语音转文字），并进行**强制对齐 (Forced Alignment)**，获取每个单词的 StartTime 和 EndTime。
- **日语处理 (NLP)**:
    - 前端接收到文本后，使用 `Kuroshiro` + `Kuromoji` 对歌词进行分词。
    - **标注**: 为每个汉字标注平假名 (Furigana) 和罗马音 (Romaji)。
- **数据结构**:
    请严格遵循以下 JSON 结构存储歌词：
    ```typescript
    interface LyricLine {
      id: string;
      startTime: number; // 秒
      endTime: number;
      text: string;      // 整句文本
      translation?: string; // 中文翻译
      tokens: {
        surface: string; // 原文 (如 "私")
        reading: string; // 平假名 (如 "わたし")
        romaji: string;  // 罗马音 (如 "watashi")
        startTime: number; // 精确到字的开始时间
        endTime: number;   // 精确到字的结束时间
        partOfSpeech: string; // 词性 (用于复习系统筛选)
      }[];
    }
    ```

### 3.3 沉浸式播放器 (Immersive Player)
- **核心功能**:
    - 播放/暂停/进度条拖拽。
    - **卡拉OK式高亮**: 利用 `requestAnimationFrame` 监听 `currentTime`，高亮当前播放的**字 (Token)**，而非仅仅是行。
    - **AB循环**: 用户可在进度条上打点 A 和 B，实现区间循环播放。
    - **视频同步**: 如果源是视频，需在歌词旁显示视频画面；如果是音频，显示旋转封面或波形。

### 3.4 AI 老师与解释系统 (AI Tutor)
- **交互方式**: 点击歌词中的某一句或某个词，弹出“AI 讲解”面板。
- **Prompt 设计**:
    - 角色: 资深日语老师。
    - 任务: 解释语法结构、单词含义、文化背景。
    - 上下文: 发送请求时，需附带该句歌词的前后各一句作为 Context。

### 3.5 复习与卡片系统 (SRS Review)
- **加入生词本**: 用户点击歌词中的单词，可点击“加入复习”。
- **卡片生成**: 调用 LLM 自动生成卡片内容（正面: 单词；背面: 假名、例句、来源歌曲片段）。
- **Anki 导出**: 将生词本数据导出为 `.apkg` 格式或 CSV (包含音频片段的 Base64 编码最佳，若太难则仅导出文本)。

### 3.6 个性化与本地存储 (Settings & Storage)
- **存储**: 使用 `Dexie.js` 将用户的歌词数据、生词本、设置、以及**大模型 API Key** 存储在浏览器 IndexedDB 中。
- **配置项**:
    - LLM 设置: Base URL, API Key, Model Name.
    - 显示设置: 是否显示罗马音 (Toggle)、是否显示中文翻译 (Toggle)、字体大小。

### 3.7 分享系统 (Sharing)
- **原理**: 由于媒体资源在本地，分享链接包含：`{sourceUrl, minimalLyricsData, notes}`。
- **接收者**: 打开链接后，前端根据 `sourceUrl` 重新触发获取/下载流程，然后应用分享者的笔记数据。

### 3.8 移动端适配 (Mobile Responsive)
- **布局**:
    - Desktop: 左侧视频/封面 + 播放控件，右侧滚动歌词列表 + 侧边栏生词本。
    - Mobile: 顶部视频区域（固定比例），下方歌词滚动区域。底部浮动播放控制条。
- **交互**: 手机端点击单词改为“长按”触发菜单，避免误触。

## 4. 开发步骤建议 (对于大模型编写代码的指引)

1.  **Phase 1: 基础框架与播放器**
    - 搭建 Next.js + Tailwind 环境。
    - 实现基础 Audio 播放器，加载本地 mp3。
    - 实现 mock 数据的歌词滚动与字级高亮。

2.  **Phase 2: 后端媒体处理 (FastAPI)**
    - 编写 `yt-dlp` wrapper。
    - 集成 WhisperX，实现音频转带时间戳的 JSON。

3.  **Phase 3: 日语 NLP 集成**
    - 在前端集成 Kuroshiro。
    - 将 WhisperX 的输出转换为 `LyricLine` 结构（包含 Furigana）。

4.  **Phase 4: AI 解释与数据库**
    - 设置 Dexie.js schema。
    - 实现 OpenAI API 调用流。
    - 完成生词本 CRUD。

5.  **Phase 5: 优化与导出**
    - 移动端 CSS 调整。
    - Anki 导出功能。

## 5. UI/UX 参考
- 界面风格参考: Spotify (深色模式) + Miraa (卡片式交互)。
- 字体: 优先使用 'Noto Sans JP' 以确保日语汉字显示正确。