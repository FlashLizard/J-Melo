# J-Melo 运行指南

这个指南将帮助您在本地环境中设置并运行 J-Melo 项目。

## 环境要求

- Node.js (v16 或更高版本)
- npm
- Python (v3.10 或更高版本)
- pip
- ffmpeg (需要安装并添加到系统的 PATH 环境变量中)

## 1. 后端设置 (FastAPI)

后端负责处理媒体下载和转录。

1.  **进入后端目录**:
    ```bash
    cd backend
    ```

2.  **创建 Python 虚拟环境**:
    ```bash
    python -m venv venv
    ```

3.  **激活虚拟环境**:

    *   **在 Windows CMD 中**:
        ```bash
        .\venv\Scripts\activate.bat
        ```
        或者
        ```bash
        call .\venv\Scripts\activate
        ```
    *   **在 Windows PowerShell 中**:
        ```bash
        .\venv\Scripts\Activate.ps1
        ```
    *   **在 macOS/Linux (Bash/Zsh) 中**:
        ```bash
        source venv/bin/activate
        ```

    激活后，您的命令行提示符通常会显示 `(venv)` 或其他指示。

4.  **安装依赖**:
    ```bash
    pip install -r requirements.txt
    ```
    *注意: `torch` 和 `whisperx` 的安装可能需要一些时间。如果遇到问题，请参考它们的官方文档。*

5.  **运行后端服务**:
    ```bash
    uvicorn main:app --reload
    ```
    后端服务将在 `http://localhost:8000` 上运行。第一次运行时，它会自动下载 WhisperX 模型，这可能需要一些时间，请耐心等待。

## 2. 前端设置 (Next.js)

前端是用户与之交互的界面。

1.  **进入前端目录**:
    ```bash
    cd app
    ```

2.  **安装依赖**:
    ```bash
    npm install
    ```

3.  **设置 OpenAI API 密钥 (可选但推荐)**:
    为了使用 AI 解释功能，您需要一个 OpenAI API 密钥。
    a. 运行应用后，访问 `http://localhost:3000/settings`。
    b. 在输入框中粘贴您的 OpenAI API 密钥并保存。密钥将安全地存储在您浏览器的本地数据库中，不会上传到任何服务器。

4.  **运行前端开发服务**:
    ```bash
    npm run dev
    ```
    前端服务将在 `http://localhost:3000` 上运行。

## 3. 使用应用

1.  **确保后端和前端服务都在运行。**
2.  在浏览器中打开 `http://localhost:3000`。
3.  在 "Load a song from URL" 输入框中，粘贴一个来自 Bilibili, YouTube, 或网易云音乐的歌曲链接。
4.  点击 "Load" 按钮。应用将开始下载和处理音频，这可能需要一些时间。
5.  处理完成后，您将看到播放器加载了音频，歌词面板显示了带时间戳的歌词。
6.  点击歌词中的单词或句子，AI Tutor 面板将显示解释。
7.  您可以将单词添加到您的生词本，并在 "My Vocabulary" 页面查看、删除或导出它们。

## 4. 使用 Docker 运行后端 (可选)

如果您安装了 Docker，您可以直接使用 Docker 来运行后端服务，这样可以简化环境配置。

1.  **进入后端目录**:
    ```bash
    cd backend
    ```

2.  **构建 Docker 镜像**:
    ```bash
    docker build -t j-melo-backend .
    ```

3.  **运行 Docker 容器**:
    ```bash
    docker run -p 8000:8000 -v ./media_cache:/code/media_cache j-melo-backend
    ```
    -   `-p 8000:8000` 将容器的 8000 端口映射到主机的 8000 端口。
    -   `-v ./media_cache:/code/media_cache` 将本地的 `media_cache` 目录挂载到容器中，以实现媒体文件的持久化缓存。
