# 部署与维护

J-Melo 可以前后端分开部署。前端是 Next.js 应用，后端是 FastAPI 服务。完整功能需要后端可被浏览器访问。

## 开发环境

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

```bash
cd app
npm install
npm run dev
```

## 生产建议

- 后端使用固定 Python 虚拟环境运行 `uvicorn main:app --host 0.0.0.0 --port 8000`。
- 前端运行 `npm run build` 后用 `npm start` 或平台托管。
- 反向代理建议开启 HTTPS。
- `cors_origins` 写明确前端域名。
- `admin_token` 不要使用示例值。
- 给 `media_cache/`、`transcription_cache/`、`temp_data/`、SQLite 文件所在目录配置持久卷。

## 模型与依赖

转录使用 `faster-whisper`，模型名由 `transcription_model` 控制。对齐使用 `stable-ts`，模型名由 `alignment_model` 控制。两者首次加载可能下载模型，请提前准备磁盘空间。

系统需要可用的 `ffmpeg`。媒体抓取由 `yt-dlp` 完成，平台兼容性会随 yt-dlp 版本变化。
`media_command_concurrency` 控制 yt-dlp 信息抓取、搜索和下载子进程的并发数，默认 1。小型 VPS 或共享环境建议保持默认值；若服务器资源充足可适度调高，并配合 `media_command_queue_timeout_seconds` 控制排队等待时间。
媒体抓取接口使用异步子进程，不会长期占用 FastAPI 请求线程池；成功抓取后会写入 `media_cache_index.db`，重复 URL 会直接命中本地缓存。社区封面等外部图片代理由 `image_proxy_concurrency` 限制并发。

测试环境可以临时跳过模型加载：

```powershell
$env:J_MELO_SKIP_MODELS='1'
$env:J_MELO_CONFIG_FILE='E:\tmp\jmelo-test-config.json'
uvicorn main:app --host 127.0.0.1 --port 8000
```

也可以在 `config.json` 中设置 `load_transcription_model` 或 `load_alignment_model` 为 `false`。

## 缓存维护

后端定时清理：

- 媒体缓存：按 `media_cache_policy`。
- 临时 token 和中间文件：按 `token_cache_policy`。
- 转录缓存：按 `transcription_cache_policy`。

社区库按 `community_policy.max_size_mb` 限制总大小，单次分享按 `max_upload_mb` 限制。

## 故障排查

- 前端连不上后端：检查 `app/public/config.json`、应用设置里的后端 URL、后端 CORS 和反向代理。
- 媒体导入返回 503 或日志出现 `Too many open files`：保持 `media_command_concurrency` 为 1，稍后重试；若长期出现，检查系统文件描述符限制和是否有卡住的 yt-dlp/ffmpeg 进程。
- Explore 页面加载很慢：适当降低 `image_proxy_concurrency`，并确认反向代理没有禁用浏览器缓存。
- 转录任务一直排队：检查 `task_worker_enabled`、后端日志和模型是否加载成功。
- 对齐失败：确认音频文件存在、`stable-ts` 可加载、歌词文本不为空。
- 社区上传 413：降低封面或导出数据体积，或调整 `max_upload_mb` 和社区配额。
- 管理后台 403：检查 Authorization Bearer token 是否与 `admin_token` 一致。
