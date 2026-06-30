# 部署与维护

J-Melo 可以前后端分开部署。前端是 Next.js 应用，后端是 FastAPI 服务。完整功能需要后端可被浏览器访问。

## 开发环境

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn --app-dir . main:app --reload --host 0.0.0.0 --port 8000
```

```bash
cd app
npm install
npm run dev
```

## 生产建议

- 后端使用固定 Python 虚拟环境运行 `python -m uvicorn --app-dir /opt/J-Melo/backend main:app --host 127.0.0.1 --port 8000`，并确保服务用户可以写入 `config.json`、SQLite 文件和缓存目录。
- 前端运行 `npm run build` 后用 `npm start` 或平台托管。
- 反向代理建议开启 HTTPS。
- `cors_origins` 写明确前端域名。
- `admin_token` 不要使用示例值。
- 给 `media_cache/`、`transcription_cache/`、`temp_data/`、SQLite 文件所在目录配置持久卷。
- 反向代理、容器或进程管理器应探测 `GET /api/health`，发现后端不可达时自动重启。

如果后端运行在 VPS 上，建议使用 systemd、Docker restart policy、PM2 等进程管理方式，而不是直接把 `uvicorn` 留在交互式终端里。一个最小 systemd 服务示例：

```ini
[Unit]
Description=J-Melo backend
After=network-online.target
Wants=network-online.target

[Service]
User=YOUR_LINUX_USER
WorkingDirectory=/opt/J-Melo/backend
Environment=PATH=/opt/J-Melo/backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/bin
Environment=HOME=/opt/J-Melo/.runtime
Environment=XDG_CACHE_HOME=/opt/J-Melo/.runtime/.cache
Environment=HF_HOME=/opt/J-Melo/.runtime/.cache/huggingface
Environment=TORCH_HOME=/opt/J-Melo/.runtime/.cache/torch
Environment=J_MELO_SKIP_MODELS=0
Environment=PYTHONPATH=/opt/J-Melo/backend
ExecStart=/opt/J-Melo/backend/venv/bin/python -m uvicorn --app-dir /opt/J-Melo/backend main:app --host 127.0.0.1 --port 8000 --proxy-headers
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动前建议先创建并授权运行时目录：

```bash
mkdir -p /opt/J-Melo/.runtime /opt/J-Melo/backend/media_cache /opt/J-Melo/backend/temp_data /opt/J-Melo/backend/transcription_cache
sudo chown -R YOUR_LINUX_USER:YOUR_LINUX_USER /opt/J-Melo
```

如果出现 `Error loading ASGI app. Could not import module "main"`，优先确认 systemd 使用的是后端虚拟环境，并显式指定了 `--app-dir /opt/J-Melo/backend`。可用下面命令查看真实 traceback：

```bash
cd /opt/J-Melo/backend
source venv/bin/activate
J_MELO_SKIP_MODELS=1 python -c "import main; print('backend import ok')"
sudo journalctl -u j-melo-backend -n 100 --no-pager
```

## 模型与依赖

转录使用 `faster-whisper`，模型名由 `transcription_model` 控制。对齐使用 `stable-ts`，模型名由 `alignment_model` 控制。两者首次加载可能下载模型，请提前准备磁盘空间。

系统需要可用的 `ffmpeg`。媒体抓取由 `yt-dlp` 完成，平台兼容性会随 yt-dlp 版本变化。
`media_command_concurrency` 控制 yt-dlp 信息抓取、搜索和下载子进程的并发数，默认 1。小型 VPS 或共享环境建议保持默认值；若服务器资源充足可适度调高，并配合 `media_command_queue_timeout_seconds` 控制排队等待时间。
媒体抓取接口使用异步子进程，不会长期占用 FastAPI 请求线程池；成功抓取后会写入 `media_cache_index.db`，重复 URL 会直接命中本地缓存。社区封面等外部图片代理由 `image_proxy_concurrency` 限制并发。

YouTube 导入在云服务器上更容易遇到地区、登录态、PO Token、JS challenge 或出口 IP 风控。后端支持这些 yt-dlp 相关配置：

```json
{
  "proxy": "http://127.0.0.1:7890",
  "yt_dlp_cookies_file": "private/cookies.txt",
  "yt_dlp_force_ipv4": true,
  "yt_dlp_js_runtimes": "node:/usr/bin/node",
  "yt_dlp_extractor_args": [
    "youtube:player_client=web_safari,android"
  ],
  "yt_dlp_extra_args": [
    "--geo-bypass"
  ]
}
```

`yt_dlp_cookies_file` 是 Netscape cookies.txt 文件路径，可相对 `backend/`。`yt_dlp_extractor_args` 每项会作为一次 `--extractor-args` 传给 yt-dlp；`yt_dlp_extra_args` 每项会原样作为一个命令行参数传给 yt-dlp。修改这些配置后需要重启后端服务。

建议定期更新 yt-dlp：

```bash
cd /opt/J-Melo/backend
source venv/bin/activate
python -m pip install -U yt-dlp
python -m yt_dlp --version
```

测试环境可以临时跳过模型加载：

```powershell
$env:J_MELO_SKIP_MODELS='1'
$env:J_MELO_CONFIG_FILE='E:\tmp\jmelo-test-config.json'
python -m uvicorn --app-dir . main:app --host 127.0.0.1 --port 8000
```

也可以在 `config.json` 中设置 `load_transcription_model` 或 `load_alignment_model` 为 `false`。

## 缓存维护

后端定时清理：

- 媒体缓存：按 `media_cache_policy`。
- 临时 token 和中间文件：按 `token_cache_policy`。
- 转录缓存：按 `transcription_cache_policy`。

社区库按 `community_policy.max_size_mb` 限制总大小，单次分享按 `max_upload_mb` 限制。

## 故障排查

- 前端连不上后端：先直接访问 `https://你的后端域名/api/health`。如果返回 502/504，说明请求没有到 FastAPI，重点检查后端进程、容器、systemd、反向代理 upstream 和平台是否有空闲休眠策略；浏览器里的 CORS 报错只是网关 502 没有应用 CORS 头导致的表象。
- 后端提示 `Could not import module "main"`：确认启动目录是 `/opt/J-Melo/backend`，并使用 `/opt/J-Melo/backend/venv/bin/python -m uvicorn --app-dir /opt/J-Melo/backend main:app`；再用 `J_MELO_SKIP_MODELS=1 python -c "import main"` 查看缺失依赖或路径错误。
- 后端空闲一段时间后不可用：确认进程不是跑在会断开的 SSH/终端会话里；给 systemd/Docker 配置自动重启；在 Nginx、云平台或外部监控中用 `/api/health` 做健康检查或低频保活。
- YouTube 返回 `Video unavailable`：先升级 yt-dlp；确认服务器出口地区能观看该视频；必要时配置 `proxy`、`yt_dlp_cookies_file`、`yt_dlp_js_runtimes`、`yt_dlp_extractor_args` 或 `yt_dlp_extra_args`。如果某个视频本身已下架、私有或地区不可见，后端无法绕过平台限制。
- 媒体导入返回 503 或日志出现 `Too many open files`：保持 `media_command_concurrency` 为 1，稍后重试；若长期出现，检查系统文件描述符限制和是否有卡住的 yt-dlp/ffmpeg 进程。
- Explore 页面加载很慢：适当降低 `image_proxy_concurrency`，并确认反向代理没有禁用浏览器缓存。
- 转录任务一直排队：检查 `task_worker_enabled`、后端日志和模型是否加载成功。
- 对齐失败：确认音频文件存在、`stable-ts` 可加载、歌词文本不为空。
- 社区上传 413：降低封面或导出数据体积，或调整 `max_upload_mb` 和社区配额。
- 管理后台 403：检查 Authorization Bearer token 是否与 `admin_token` 一致。
