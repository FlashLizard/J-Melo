# Media Retrieval & Processing

J-Melo relies on a robust Python FastAPI backend to handle the heavy lifting of fetching media and generating initial transcriptions.

## Architecture

-   **Frontend:** Sends requests with media URLs (YouTube, Bilibili, etc.) to the backend API.
-   **Backend (FastAPI):**
    -   **`yt-dlp` Integration:** Uses the `yt-dlp` command-line tool via Python's `subprocess` module to extract metadata (title, artist, duration, thumbnails) and download the best available audio stream, converting it to MP3 format.
    -   **Non-Blocking Execution:** Subprocess calls to `yt-dlp` are executed within FastAPI's external thread pool (`asyncio.to_thread` / standard `def` routes), preventing long downloads from blocking the main server loop and allowing the backend to handle multiple users simultaneously.
    -   **Local Caching:** Downloaded audio files are stored in a `media_cache` directory on the server. Subsequent requests for the same URL will serve the cached file immediately.

## Audio Transcription (`faster-whisper`)

-   **Integration:** The backend loads a `faster-whisper` model (defaulting to the `tiny` model for speed, optimized for `int8` on CUDA if available) into memory upon startup.
-   **Syllable-Level Timing:** When requested via the `/api/transcribe` endpoint, the backend processes the cached audio file. Crucially, it is configured to request `word_timestamps=True`, which allows the model to return start and end times for individual Japanese words/syllables.
-   **Concurrency Control (Semaphore):** Because neural network inference is extremely CPU/GPU intensive, the transcription endpoint is protected by an `asyncio.Semaphore(1)`. This acts as a queue: while the server can accept hundreds of transcription requests at once, it will only actively process *one* audio file at a time, preventing Out-Of-Memory (OOM) crashes and CPU starvation.
-   **Formatting:** The raw output from `faster-whisper` is formatted into a standardized JSON structure that the J-Melo frontend expects before being returned.