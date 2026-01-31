# 模块实现: 媒体搜索与获取 (Media Retrieval)

## 1. 目标
实现一个可靠的后端服务，能够接收来自前端的 URL 或关键字，从 Bilibili, YouTube, 网易云音乐等平台获取媒体资源（音视频），并将其提供给前端。

## 2. 技术选型
- **后端框架**: FastAPI (Python)
- **核心库**: `yt-dlp`
- **缓存**: 本地文件系统 (由 FastAPI 管理)

## 3. API 设计

### Endpoint: `/api/media/fetch`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "url": "https://www.youtube.com/watch?v=...",
    "force_redownload": false // 可选，是否强制重新下载
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "media_type": "video", // "video" or "audio"
    "title": "歌曲标题",
    "artist": "艺术家",
    "cover_url": "https://.../cover.jpg",
    "duration": 245.5, // 秒
    "media_url": "/local_media/unique_id.mp4" // 指向后端缓存的本地文件URL
  }
  ```
- **Error Response (4xx/5xx)**:
  ```json
  {
    "detail": "错误信息，例如：URL 不支持或下载失败。"
  }
  ```

## 4. 实现细节

### 4.1 `yt-dlp` Wrapper
- 创建一个 `YTDLPServce` 类来封装 `yt-dlp` 的调用逻辑。
- **下载选项**:
    - `-f 'bestaudio/best'`: 优先下载最佳音质。如果需要视频，则使用 `bestvideo+bestaudio/best`。
    - `--extract-audio --audio-format mp3`: 对于视频源，明确指示提取为 MP3 音频。
    - `--get-thumbnail`: 获取封面图。
    - `--get-duration`: 获取时长。
    - `-o '/path/to/cache/%(id)s.%(ext)s'`: 将文件下载到指定的缓存目录，并以媒体的唯一 ID 命名，避免重复。

### 4.2 缓存管理
- 后端需要一个指定的目录（例如 `./media_cache`）来存储下载的媒体文件。
- 在处理请求时，首先检查基于 URL 生成的唯一文件名是否已存在于缓存中。
- 如果文件存在且 `force_redownload` 为 `false`，则直接返回本地文件的信息。
- 如果文件不存在或需要强制重新下载，则调用 `yt-dlp`。
- **静态文件服务**: FastAPI 应用需要配置为可以从 `./media_cache` 目录提供静态文件服务，这样前端才能通过 `/local_media/...` URL 访问到它们。

### 4.3 错误处理
- 捕获 `yt-dlp` 执行过程中可能出现的各种异常（如网络错误、URL 不支持、版权限制等）。
- 向前端返回清晰的错误信息。

## 5. 前端交互
- 前端通过 `fetch` 调用 `/api/media/fetch`。
- 接收到成功响应后，将 `media_url`（例如 `/local_media/unique_id.mp4`）与后端的域名拼接成完整的 URL（例如 `http://localhost:8000/local_media/unique_id.mp4`）。
- 将此完整 URL 设置为 `<audio>` 或 `<video>` 元素的 `src` 属性。

## 6. 待办事项
- [ ] 实现 `YTDLPServce` 类。
- [ ] 创建 `/api/media/fetch` endpoint。
- [ ] 配置 FastAPI 的静态文件服务。
- [ ] 编写下载与缓存逻辑。
- [ ] 增加详细的日志记录，方便排查问题。
