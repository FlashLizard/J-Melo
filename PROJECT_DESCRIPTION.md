# J-Melo 项目描述

本文档旨在提供 J-Melo 项目的总体概述、技术选型和各模块的实现细节。

## 1. 项目概述

J-Melo 是一个通过音乐学习日语的沉浸式 Web 应用。用户可以输入来自 YouTube、Bilibili 等平台的歌曲链接，应用会自动获取媒体、生成带时间戳的歌词，并提供卡拉 OK 式的歌词高亮、AI 语法解释、生词本等功能，旨在创造一个有趣且高效的学习环境。

## 2. 技术栈

- **前端**:
  - **框架**: Next.js (React)
  - **语言**: TypeScript
  - **样式**: Tailwind CSS
  - **状态管理**: Zustand
  - **本地数据库**: Dexie.js (IndexedDB wrapper)
  - **日语处理**: kuroshiro, kuromoji

- **后端**:
  - **框架**: FastAPI
  - **语言**: Python
  - **媒体下载**: yt-dlp
  - **语音转录**: WhisperX
  - **部署**: Docker

## 3. 模块详解

### 前端 (`app` 目录)

前端是用户交互的核心，采用组件化和状态分离的架构。

- **状态管理 (`src/stores`)**:
  - 使用 Zustand 进行全局状态管理，逻辑清晰，易于维护。
  - `useSongStore`: 管理当前歌曲信息（元数据、歌词）、加载状态和错误。负责调用后端接口获取数据。
  - `usePlayerStore`: 管理播放器状态，包括播放/暂停、当前时间、总时长、AB 循环点。
  - `useTutorStore`: 管理 AI 导师面板的状态，包括用户选择的文本、AI 返回的解释和加载状态。

- **播放器模块 (`src/components/player`)**:
  - `Player.tsx`: 组合 `MediaDisplay` 和 `PlayerControls` 的主组件。
  - `MediaDisplay.tsx`: 负责渲染 `<video>` 或 `<audio>` 元素，根据后端返回的 `media_type` 动态选择。
  - `PlayerControls.tsx`: 提供自定义的播放、暂停、进度条拖动、AB 循环设置等 UI 控件。

- **歌词模块 (`src/components/lyrics`)**:
  - `LyricsDisplay.tsx`: 核心的歌词显示组件。接收歌词数据和播放器当前时间，实现卡拉 OK 式的逐行、逐词高亮，并允许用户点击单词或句子与 AI 导师交互。

- **日语处理 (`src/hooks/useLyricsProcessor.ts`)**:
  - `useLyricsProcessor`: 一个自定义 Hook，负责调用 `kuroshiro` 和 `kuromoji`。它接收后端 WhisperX 返回的原始转录数据，进行分词和注音（平假名、罗马音），并将其格式化为前端所需的 `LyricLine[]` 结构。
  - `kuroshiro` 的字典文件被存储在 `public/dict` 目录下，以供客户端在运行时加载。

- **AI 导师 (`src/components/tutor`)**:
  - `AIPanel.tsx`: 显示 AI 解释的 UI 面板。
  - 用户在设置页面可以自定义 LLM 供应商的 API URL、模型名称和 API Key，以适应不同的模型（如 OpenAI, Claude 等）。
  - 当用户点击歌词时，`useTutorStore` 会调用 `fetchExplanation` 方法，向配置的 LLM API 发送请求并显示结果。

- **本地数据库 (`src/lib/db.ts`)**:
  - 使用 `Dexie.js` 封装 IndexedDB，实现浏览器端的持久化存储。
  - 定义了三张表：`songs` (缓存歌曲和歌词数据), `words` (生词本), `settings` (用户配置)。
  - `useSongStore` 在获取歌曲时会先检查数据库缓存，避免重复下载和处理。

- **页面 (`src/pages`)**:
  - `index.tsx`: 主播放页面，集成了播放器、歌词和 AI 导师面板，并实现了桌面和移动端的响应式布局。
  - `settings.tsx`: 设置页面，允许用户配置 LLM API Key、URL 和模型。
  - `vocabulary.tsx`: 生词本页面，展示用户添加的单词，并提供删除和 CSV 导出功能。

### 后端 (`backend` 目录)

后端是一个独立的 FastAPI 服务，负责所有耗时的媒体处理和 AI 计算任务。

- **媒体处理 (`/api/media/fetch`)**:
  - 接收前端发送的媒体 URL。
  - 使用 `yt-dlp` 获取媒体元信息，并判断是视频还是音频。
  - 根据媒体类型下载相应的文件（视频为 mp4，音频为 mp3），并保存在 `media_cache` 目录中。
  - 返回媒体的元数据和在后端服务上的访问路径。

- **语音转录 (`/api/transcribe`)**:
  - 接收媒体在服务器上的本地路径。
  - 使用 `WhisperX` 模型进行高精度的语音转录，生成带时间戳的单词。
  - 为了提高日语转录的准确性，代码中已显式指定 `language="ja"`。
  - 包含了对齐 (alignment) 逻辑，以获得更精确的单词时间戳。

- **文件服务与部署**:
  - `StaticFiles`: FastAPI 通过 `app.mount` 将 `media_cache` 目录挂载为静态文件服务，使前端可以通过 URL 直接访问。
  - `Dockerfile`: 提供了一个完整的 `Dockerfile`，用于构建后端的容器化镜像，简化了部署流程。
  - **模型加载修复**: 包含了针对新版 PyTorch `weights_only` 安全限制的修复，确保 WhisperX 模型能被正确加载。

## 5. AI Lyric Correction

This tool allows users to fix incorrect or poorly timed lyrics using an LLM. Users can provide a block of correct lyric text. The system then uses a configurable prompt template to ask an LLM to re-transcribe the song's audio, using the provided text as a reference, and to output a perfectly structured and timed lyric JSON. The user can then preview and apply these new, corrected lyrics.
