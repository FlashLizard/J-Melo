# 模块实现: 智能歌词系统 (Smart Lyrics System)

## 1. 目标
建立一个能够自动生成、处理和丰富日语歌词的系统。核心任务包括：从音频生成时间戳精确到字的歌词，并为汉字标注平假名和罗马音。

## 2. 技术选型
- **语音转文字 (ASR)**: `WhisperX` (在后端 FastAPI 中运行)
- **日语 NLP**: `Kuroshiro` + `Kuromoji.js` (在前端 React 中运行)
- **数据持久化**: `Dexie.js` (IndexedDB)

## 3. 后端 API 设计 (ASR)

### Endpoint: `/api/transcribe`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "media_path": "/path/to/cache/unique_id.mp3" // 指向已下载的音频文件
  }
  ```
- **Success Response (200 OK)**:
  返回 WhisperX 的原始输出，一个包含 `segments` 的 JSON 对象，每个 segment 包含 `text` 和 `words` 数组（每个 word 带有 `start` 和 `end` 时间）。
  ```json
  {
    "text": "...",
    "segments": [
      {
        "text": "私 の 前に 現れた のは",
        "start": 0.5,
        "end": 3.2,
        "words": [
          {"word": "私", "start": 0.5, "end": 0.8},
          {"word": "の", "start": 0.8, "end": 0.9},
          // ... more words
        ]
      }
    ]
  }
  ```

## 4. 前端实现细节

### 4.1 数据流
1.  前端在获取媒体后，调用后端的 `/api/transcribe` 并传入音频文件的路径。
2.  后端运行 WhisperX，返回 ASR 结果。
3.  前端接收到 JSON 结果，启动日语 NLP 处理流程。

### 4.2 日语 NLP 处理 (`useLyricsProcessor` Hook)
- **输入**: WhisperX 返回的 JSON 数据。
- **核心库**: `kuroshiro`。需要初始化一个实例，并加载 `kuromoji` 词典。
  ```typescript
  import Kuroshiro from "kuroshiro";
  import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

  const kuroshiro = new Kuroshiro();
  // 在组件挂载时异步初始化
  await kuroshiro.init(new KuromojiAnalyzer({ dictPath: "/path/to/dict" }));
  ```
- **处理步骤**:
    1. 遍历 WhisperX 返回的 `segments`，将它们合并成一个完整的句子或段落列表。
    2. 对每个句子的 `text`，调用 `kuroshiro.convert()` 方法。
       - **目标**: `to: "hiragana"` 和 `to: "romaji"`。
       - **模式**: `mode: "furigana"`，这将返回一个带注音标签的 HTML 字符串，或者 `mode: "verbose"` 返回结构化数据。推荐使用 `verbose` 模式以获得更灵活的数据结构。
    3. **数据结构转换**: 将 `kuroshiro` 的输出和 WhisperX 的 `words` 时间戳数据进行**对齐和合并**。这是本模块最关键和复杂的步骤。
        - 遍历 `kuroshiro` 返回的 token 列表（包含 `surface`, `reading`, `part_of_speech` 等）。
        - 同时，维护一个指向 WhisperX `words` 数组的指针。
        - 将 `kuroshiro` 的分词结果与 WhisperX 的分词结果进行匹配。由于两者分词方式可能不同，需要设计一个健壮的对齐算法。例如，可以按字符累加，当 `kuroshiro` 的多个 token 拼接起来与 WhisperX 的一个 `word` 匹配时，就将这个 `word` 的 `startTime` 和 `endTime` 分配给这些 token。
    4. **最终输出**: 生成符合 `requirements.md` 中定义的 `LyricLine[]` 结构化数据。

### 4.3 数据存储
- 处理完成后，将生成的 `LyricLine[]` 数组以及歌曲的元数据（标题、歌手等）作为一个整体对象存入 IndexedDB。
- **Schema 设计 (`songs` table)**:
  ```typescript
  db.version(1).stores({
    songs: `
      ++id,          // 自增主键
      sourceUrl,     // 原始媒体 URL，可建立索引
      title,
      artist,
      coverUrl,
      duration,
      lyrics,        // 存储 LyricLine[] JSON 对象
      createdAt
    `
  });
  ```

## 5. 待办事项
- [ ] **后端**: 实现 `/api/transcribe` endpoint，集成 WhisperX。
- [ ] **前端**: 在项目中集成 `kuroshiro` 和 `kuromoji` 词典。
- [ ] **前端**: 实现 `useLyricsProcessor` hook。
- [ ] **前端**: **重点攻关**: 设计并实现 `kuroshiro` 和 `WhisperX` 输出的对齐算法。
- [ ] **前端**: 实现将处理结果存入 Dexie.js 的逻辑。
