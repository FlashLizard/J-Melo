# J-Melo

J-Melo 是一个面向“自托管小圈子”的日语歌学习工具：前端负责本地歌曲库、歌词编辑、词卡和复习；后端负责媒体抓取、语音转录、歌词对齐、社区分享与管理。它不假设大型公开平台，也不引入 Redis、Celery 或账号体系，核心目标是轻量、可迁移、可自管。

- 官网：[j-melo.flashlizard.top](https://j-melo.flashlizard.top/)
- 演示视频：[Bilibili BV16AADzPExn](https://www.bilibili.com/video/BV16AADzPExn/)

## 功能概览

- 歌曲导入：通过 URL 抓取 YouTube、Bilibili、网易云等 yt-dlp 支持的媒体，并缓存为本地音频。
- 沉浸式播放器：三栏播放器、歌词高亮、移动端滑动视图、注音和翻译显示开关。
- 歌词系统：支持转录生成、PetitLyrics/Utaten 导入、无时间轴歌词导入、AI 校正、AI 翻译、手动编辑和 JSON 编辑。
- 词汇学习：选词生成解释，保存为词卡，按歌曲或全局管理，支持 Anki CSV 导出和 SRS 复习。
- 社区分享：把歌曲、歌词、词卡和封面分享到自托管社区库，其他用户可搜索并导入。
- 管理后台：通过 Bearer token 查看缓存、清理数据、配置缓存策略、管理社区内容。
- 数据迁移：前端 IndexedDB 使用 Dexie 版本迁移；导出 JSON 带 `version`，导入仍兼容旧版无版本数据。

## 技术路线

```mermaid
flowchart LR
  Browser["Next.js / React 前端"] --> IndexedDB["Dexie IndexedDB<br/>歌曲、词卡、设置、模板"]
  Browser --> BackendClient["backendClient<br/>统一后端请求"]
  Browser --> LLMClient["llmClient<br/>OpenAI 兼容 LLM"]
  BackendClient --> FastAPI["FastAPI app factory<br/>api/routes.py"]
  FastAPI --> Services["service 层<br/>media / lyrics / transcription / alignment / admin"]
  Services --> TaskQueue["SQLite task_queue.db<br/>转录/对齐持久任务"]
  Services --> CommunityDB["SQLite shared_songs.db<br/>社区分享库"]
  Services --> Cache["media_cache / transcription_cache / temp_data"]
  Services --> Models["faster-whisper / stable-ts / Sudachi"]
```

前端是 Next.js、React、TypeScript、Zustand、Dexie 和 Tailwind。后端是 FastAPI、SQLite、yt-dlp、faster-whisper、stable-ts、SudachiPy。LLM 请求默认从浏览器直连 OpenAI 兼容接口，后端不代理用户的 LLM Key。

## 目录结构

```text
app/                     Next.js 前端
  src/lib/               IndexedDB、backendClient、llmClient、AI JSON 工具
  src/stores/            Zustand 状态
  src/components/        播放器、歌词、词汇、社区、工具面板
  public/config.json     可选的前端部署配置
backend/                 FastAPI 后端
  main.py                app factory、模型加载、startup worker
  api/routes.py          API 路由兼容层
  core/                  配置、模型、通用工具
  services/              业务服务和 SQLite 任务队列
  config.json            可选的后端运行配置
docs/                    中文专题文档
```

## 开发启动

后端：

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy config.json.example config.json
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

前端：

```bash
cd app
npm install
copy public\config.json.example public\config.json
npm run dev
```

打开 `http://localhost:3000`。如果后端不在 `http://localhost:8000`，请修改 `app/public/config.json` 或前端设置页里的后端地址。

## 后端配置

后端会读取 `backend/config.json`，缺失字段自动使用默认值。路径字段统一相对 `backend/` 解析，避免因为启动目录不同而写到错误位置。

常用配置：

```json
{
  "admin_token": "your-secret-token-here",
  "cors_origins": ["http://localhost:3000"],
  "media_cache_dir": "media_cache",
  "transcription_cache_dir": "transcription_cache",
  "community_db_path": "shared_songs.db",
  "task_db_path": "task_queue.db",
  "transcription_model": "medium",
  "transcription_compute_type": "int8",
  "alignment_model": "base",
  "load_transcription_model": true,
  "load_alignment_model": true,
  "task_worker_enabled": true,
  "max_upload_mb": 50,
  "media_command_concurrency": 1,
  "media_command_queue_timeout_seconds": 30,
  "image_proxy_concurrency": 8
}
```

公网部署时建议把 `cors_origins` 写成明确域名；如果需要管理后台，请务必设置 `admin_token`。
`media_command_concurrency` 控制 yt-dlp 抓取、下载和搜索子进程并发数，默认 1，适合小型服务器并可避免文件描述符耗尽；媒体抓取结果会写入 `media_cache_index.db`，同一 URL 后续导入会直接复用缓存文件。
`image_proxy_concurrency` 控制社区封面等外部图片代理并发，避免 Explore 页面一次性打开大量外部连接。
测试或 CI 可以设置环境变量 `J_MELO_SKIP_MODELS=1` 暂时跳过转录和对齐模型加载；如需隔离真实配置，可用 `J_MELO_CONFIG_FILE` 指向临时配置文件。

## Linux 部署教程

下面以 Ubuntu/Debian、前后端同一台服务器、Nginx 反向代理为例。示例域名请替换为自己的域名，例如前端 `https://j-melo.example.com`、后端 `https://j-melo-api.example.com`。

### 1. 安装系统依赖

```bash
sudo apt update
sudo apt install -y git curl nginx ffmpeg python3 python3-venv python3-pip build-essential

# Node.js 需要 20 或更高版本；如果系统源版本过旧，可使用 NodeSource 或 nvm。
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 2. 拉取代码

```bash
sudo mkdir -p /opt/J-Melo
sudo chown -R "$USER:$USER" /opt/J-Melo
git clone https://github.com/FlashLizard/J-Melo.git /opt/J-Melo
cd /opt/J-Melo
```

如果是私有部署或 fork，也可以把仓库地址替换为自己的远程仓库。

### 3. 部署后端

```bash
cd /opt/J-Melo/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp config.json.example config.json
```

编辑 `backend/config.json`，至少修改下面几项：

```json
{
  "admin_token": "replace-with-a-long-random-token",
  "cors_origins": ["https://j-melo.example.com"],
  "load_transcription_model": true,
  "load_alignment_model": true,
  "media_command_concurrency": 1
}
```

小内存服务器可以先把 `load_transcription_model` 和 `load_alignment_model` 设为 `false`，确认媒体导入、歌词导入和社区功能正常后再开启模型。

创建 systemd 服务：

```bash
sudo tee /etc/systemd/system/j-melo-backend.service >/dev/null <<'EOF'
[Unit]
Description=J-Melo backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_LINUX_USER
WorkingDirectory=/opt/J-Melo/backend
Environment=J_MELO_SKIP_MODELS=0
ExecStart=/opt/J-Melo/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --proxy-headers
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF
```

把 `YOUR_LINUX_USER` 替换成实际部署用户，然后启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now j-melo-backend
sudo systemctl status j-melo-backend
curl http://127.0.0.1:8000/api/health
```

### 4. 部署前端

```bash
cd /opt/J-Melo/app
npm ci
cp public/config.json.example public/config.json
```

编辑 `app/public/config.json`，把后端地址指向公网 HTTPS 后端：

```json
{
  "backendUrl": "https://j-melo-api.example.com"
}
```

构建前端：

```bash
npm run build
```

创建 systemd 服务：

```bash
sudo tee /etc/systemd/system/j-melo-frontend.service >/dev/null <<'EOF'
[Unit]
Description=J-Melo frontend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_LINUX_USER
WorkingDirectory=/opt/J-Melo/app
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

启动前端：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now j-melo-frontend
sudo systemctl status j-melo-frontend
curl http://127.0.0.1:3000
```

### 5. 配置 Nginx 反向代理

前端站点：

```nginx
server {
    listen 80;
    server_name j-melo.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

后端站点：

```nginx
server {
    listen 80;
    server_name j-melo-api.example.com;

    client_max_body_size 80m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

保存到 `/etc/nginx/sites-available/j-melo` 后启用：

```bash
sudo ln -s /etc/nginx/sites-available/j-melo /etc/nginx/sites-enabled/j-melo
sudo nginx -t
sudo systemctl reload nginx
```

生产环境请用 Certbot、云厂商证书或其他方式开启 HTTPS。开启 HTTPS 后，记得同步修改：

- `backend/config.json` 的 `cors_origins`
- `app/public/config.json` 的 `backendUrl`
- Nginx 的 `server_name` 和证书配置

### 6. 更新部署

```bash
cd /opt/J-Melo
git pull --ff-only

cd backend
source venv/bin/activate
pip install -r requirements.txt
python -m py_compile main.py api/routes.py core/config.py core/models.py core/utils.py services/*.py
sudo systemctl restart j-melo-backend

cd ../app
npm ci
npm run build
sudo systemctl restart j-melo-frontend
```

如果更新后前端连不上后端，先检查 `https://你的后端域名/api/health`。如果公网返回 502/504，通常是后端进程或 Nginx upstream 问题；如果 health 正常但浏览器报 CORS，再检查 `cors_origins` 是否包含当前前端域名。

## API 兼容性

保留的主要接口包括：

- `/api/media/*`
- `/api/transcribe` 和 `/api/transcribe/status/{media_id}`
- `/api/lyrics/*`
- `/api/community/*`
- `/api/admin/*`
- `/api/export`、`/api/import`

新增 `/api/tasks/{task_id}` 用于统一查询持久任务，`/api/health` 用于反向代理、容器和保活探针。旧的转录和对齐状态接口仍可使用，会映射到新的 SQLite 任务表。

## 数据与隐私

- 歌曲、歌词、词卡、设置和模板主要保存在浏览器 IndexedDB。
- 后端会保存媒体缓存、转录缓存、社区分享库和任务队列表。
- 分享到社区时，歌曲数据、词卡、分享昵称和可选封面会写入后端 SQLite。
- LLM 功能默认由浏览器直接请求你配置的 OpenAI 兼容接口，请自行确认服务商的数据政策。
- 导出文件包含歌曲元数据、歌词、词卡、设置和模板，不包含音频二进制缓存。

## 测试与检查

```bash
cd app
npm run type-check
npm test -- --runInBand

cd ../backend
python -m py_compile main.py api/routes.py core/config.py core/models.py core/utils.py services/*.py
.\venv\Scripts\python.exe -m pytest
```

后端测试依赖 `pytest`，已写入 `backend/requirements.txt`。

## 专题文档

- [架构总览](docs/architecture.md)
- [前端本地数据](docs/frontend_local_data.md)
- [后端任务队列](docs/backend_task_queue.md)
- [歌词系统](docs/lyrics_system.md)
- [AI 工具](docs/ai_tools.md)
- [社区与后台](docs/community_admin.md)
- [部署与维护](docs/deployment_maintenance.md)

## 迁移说明

从旧版本升级时通常只需要拉取代码、安装新依赖并重启服务。前端 IndexedDB 会自动执行 Dexie 版本迁移；后端 SQLite 表会在启动时自动创建索引和缺失表。旧的导出 JSON 和社区导入数据仍然被导入器接受。

第一次启动新后端时，`task_queue.db` 会自动创建。若服务器重启时有 `processing` 状态任务，启动后会恢复为 `pending`，由默认单 worker 继续串行处理。

## 常见问题

**转录很慢怎么办？**  
转录和对齐属于重任务，默认单 worker 串行执行，避免小机器被并发任务压垮。可以降低 `transcription_model`，或调整 `transcription_compute_type`。

**为什么社区没有账号体系？**  
项目定位是自托管小圈子。删除自己的分享依赖分享昵称，管理员可以用后台 token 强制删除。

**为什么歌词校正/翻译有时失败？**  
LLM 输出可能不是合法 JSON。前端会尝试提取 fenced/raw JSON，并在失败时保留手动编辑和重试入口。

**可以不使用后端吗？**  
可以使用部分本地功能，但 URL 导入、媒体缓存、转录、对齐、社区和后台都需要后端。

**为什么浏览器显示 CORS，但同时是 502 Bad Gateway？**
这通常不是 FastAPI 的 CORS 配置问题，而是反向代理没有连到存活的后端进程。网关自己生成的 502 不会带应用的 CORS 头，所以浏览器会把它显示成 CORS 失败。生产环境应让进程管理器或容器健康检查持续探测 `/api/health`，并在失败时自动重启后端。
