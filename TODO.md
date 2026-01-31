# J-Melo Project TODO

This file tracks the development tasks for the J-Melo project, based on the requirements and implementation plans.

## Phase 1: 基础框架与播放器
- [x] **Task 1.1**: 搭建 Next.js + Tailwind CSS + TypeScript 项目环境。
- [x] **Task 1.2**: 实现基础的 Audio/Video 播放器组件 (`<Player />`)，能够加载并播放媒体 URL。
- [x] **Task 1.3**: 设计并实现卡拉OK式歌词高亮组件 (`<LyricsDisplay />`)。
- [x] **Task 1.4**: 使用 `requestAnimationFrame` 监听播放器 `currentTime`，实现字级高亮。
- [x] **Task 1.5**: 实现 AB 循环播放功能。
- [x] **Task 1.6**: Mock 歌词数据 (`LyricLine[]`) 用于前端开发测试。

## Phase 2: 后端媒体处理 (FastAPI)
- [x] **Task 2.1**: 设置 FastAPI 后端项目。
- [x] **Task 2.2**: 创建 `/api/media/fetch` endpoint，使用 `yt-dlp` 下载 Bilibili, YouTube, 网易云音乐的媒体。
- [x] **Task 2.3**: 实现从视频中提取音频轨道的功能。
- [x] **Task 2.4**: 集成 `WhisperX`，创建 `/api/transcribe` endpoint，对音频进行转录并生成带时间戳的单词。
- [x] **Task 2.5**: 编写 Dockerfile 用于后端部署。

## Phase 3: 日语 NLP 与数据集成
- [x] **Task 3.1**: 在前端集成 `kuroshiro` 和 `kuromoji`。
- [x] **Task 3.2**: 创建一个 `useLyricsProcessor` hook，将后端返回的原始转录文本处理成 `LyricLine[]` 结构。
- [x] **Task 3.3**: 实现分词、注音（平假名和罗马音）的逻辑。
- [x] **Task 3.4**: 将处理后的歌词数据与播放器状态同步。

## Phase 4: AI 解释与数据库
- [x] **Task 4.1**: 使用 `Dexie.js` 设置 IndexedDB 数据库，定义 `songs`, `words`, `settings` 的 schema。
- [x] **Task 4.2**: 实现将处理后的歌曲和歌词数据存入 IndexedDB。
- [x] **Task 4.3**: 创建 AI Tutor 面板 (`<AIPanel />`)。
- [x] **Task 4.4**: 实现调用用户配置的 OpenAI API 进行句子/单词解释的功能。
- [x] **Task 4.5**: 实现生词本的增、删、查、改 (CRUD) 功能。

## Phase 5: 核心功能完善
- [x] **Task 5.1**: 实现 Anki `.apkg` 或 CSV 导出功能。
- [x] **Task 5.2**: 实现本地设置页面，允许用户配置 LLM API Key、显示选项等。
- [x] **Task 5.3**: 实现分享功能，生成包含源 URL 和最小化数据的链接。
- [x] **Task 5.4**: 完善移动端响应式布局，适配手机和平板。

## Phase 6: 测试与优化
- [/] **Task 6.1**: 编写单元测试和集成测试。 (已安装测试依赖并尝试编写测试，但遇到配置问题)
- [ ] **Task 6.2**: 对前端性能进行分析和优化，特别是歌词高亮部分。
- [ ] **Task 6.3**: 对后端 API 进行压力测试。
- [/] **Task 6.4**: 修复 Bug 和 UI/UX 细节调整。 (已修复生词本保存的 bug)
