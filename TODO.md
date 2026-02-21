# J-Melo TODO List

## Core Player Features
- [x] Initial player setup (React Player or HTML5 Audio).
- [x] Fetch media info (title, artist, duration, cover) from URL via backend (`yt-dlp`).
- [x] Fetch and stream audio from backend.
- [x] Basic playback controls (play, pause, seek, volume).
- [x] Visual player UI (rotating vinyl record for cover art).
- [x] Toggle UI language (English/Chinese).
- [x] Toggle display of Furigana (readings).
- [x] Toggle display of Chinese translations.

## Lyrics System
- [x] Setup basic lyrics data structure (JSON with `startTime`, `endTime`, `text`, `tokens`).
- [x] Synchronized lyrics scrolling based on current audio time.
- [x] Syllable-level highlighting (if token timing is available).
- [x] Fallback "No Lyrics" view.
- [x] Backend integration for automatic transcription (`faster_whisper`).
- [x] Process `faster_whisper` output into `J-Melo`'s expected JSON format.
- [x] Kuromoji/Kuroshiro integration for adding Furigana to transcribed lyrics.

## Lyrics Editors
- [x] **Sentence Editor (Visual/JSON)**:
    - [x] Edit start/end times of a whole sentence.
    - [x] Edit text, reading, and timing of individual words within a sentence.
    - [x] Direct JSON editing mode for advanced users.
    - [x] Playback controls for the specific sentence being edited.
- [x] **Full Lyrics JSON Editor**:
    - [x] Textarea to edit the entire song's lyrics JSON.
    - [x] Basic JSON validation before saving.
- [x] **AI Lyric Corrector**:
    - [x] UI to paste correct lyrics text.
    - [x] Integration with an LLM API (e.g., OpenAI) to map timing to correct text.
    - [x] Customizable Prompt Template for the correction task.
    - [x] Robust LLM parsing with Error recovery and revalidation UI.
    - [x] Dynamic `max_tokens` configuration via Settings.

## Lyric Translation System
- [x] **AI Lyric Translator**:
    - [x] Provide a dedicated panel to request lyric translations via LLM.
    - [x] Support two modes: "Translate Current Lyrics" and "Map Provided Translations".
    - [x] Customizable Prompt Template for the translation task.
    - [x] Save translated text to the `translation` field of the `LyricLine` object.
    - [x] Interactive preview modal for accepting/rejecting translations.

## AI Tutor & Vocabulary (SRS)
- [x] **Word Selection**: Allow users to select words directly from the lyrics display.
- [x] **AI Explanation Panel**:
    - [x] Fetch explanation from LLM based on selected word and context sentence.
    - [x] Customizable Prompt Templates for explanations.
    - [x] Display explanation in a sidebar.
- [x] **Vocabulary Management**:
    - [x] Save selected word + explanation to local database as a "Vocab Card".
    - [x] "Vocabulary" page to list all saved words.
    - [x] Filter/Group words by Song or "All".
    - [x] Search functionality within vocabulary.
    - [x] Color-coded proficiency indicators on vocabulary list.
- [x] **Spaced Repetition System (SRS) Review Mode**:
    - [x] UI to initiate a review session (All words or specific songs).
    - [x] Weighted random selection logic based on `proficiency` score.
    - [x] Flashcard review interface (Front -> Back -> Rating).
    - [x] Update `proficiency` score based on user rating (Lowest, -1, +1, Highest).
- [x] **Card Editor**:
    - [x] UI to edit the Front and Back content of a vocab card before saving.
    - [x] Support for variables (e.g., `{word}`, `{reading}`, `{explanation}`, `{sentence}`).
    - [x] Manage and save customizable Card Templates.
    - [x] Anki CSV Export functionality for selected vocabulary.

## Community & Sharing
- [x] **Sharer Identity**: Add setting to configure a 'Sharer Nickname'.
- [x] **Share to Community**: Export songs and their associated vocabulary to a remote backend database.
- [x] **Explore Page**: Browse, search, and discover songs shared by other users on the community server.
- [x] **My Shared Page**: View and delete songs that you have previously uploaded.
- [x] **Smart Import Engine**: Handle conflicts when importing songs from the community or local files (Skip, Overwrite, Merge Words).

## Data & Settings
- [x] **Local Database (Dexie/IndexedDB)**:
    - [x] Store Songs (metadata, url, cached audio/images).
    - [x] Store Lyrics (JSON array).
    - [x] Store Vocabulary (words, readings, flashcard data, proficiency, source song).
    - [x] Store Settings (API keys, UI language, LLM preferences, Admin Policies).
- [x] **Settings Page**:
    - [x] UI Language toggle.
    - [x] LLM API configurations (Key, URL, Model) separated by tool (Tutor, Fixer, Translator).
    - [x] Backend URL configuration.
    - [x] Frontend Config (`config.json`) override for initial deployments.
- [x] **Data Backup/Restore**:
    - [x] Export all data (Songs, Words, Settings, Templates) via a temporary backend token.
    - [x] Import data using a temporary backend token.
    - [x] Handle cross-device syncing of complete Song+Vocabulary packages.

## Admin & Server Management
- [x] **Admin Authentication**: Secure endpoints with an `admin_token` stored in `backend/config.json`.
- [x] **Dashboard UI**: Dedicated `/settings/admin` page to view current cache sizes and file counts.
- [x] **Cache Control**:
    - [x] Manual buttons to clear `media_cache` (Songs) and `temp_data` (Tokens).
    - [x] Set automated cleanup policies (Max Size, Max Age) directly from the UI.
- [x] **Community Content Moderation**:
    - [x] Allow admins to enforce storage quotas on the community database to prevent abuse.
    - [x] Allow admins to list and force-delete any community song via the dashboard.
- [x] **Background Scheduler**: Python `asyncio` task to enforce cleanup policies hourly without blocking the event loop.

## UI/UX & Responsive Design
- [x] Ensure all main views (Player, Lyrics, Tutor panel, Vocab list, Admin) are usable on mobile screens.
- [x] Use drawers or sliding panels for the sidebars on small screens.
- [x] Implement horizontal swiping to navigate between Main, Lyrics, and Tools tabs on mobile.
- [x] Make floating/modal windows responsive and scrollable.
- [x] Optimize Header buttons with dropdown menus to prevent clutter on smaller screens.
- [x] Add an "About J-Melo" modal to describe the project.

## Backend Improvements
- [x] Replace blocking subprocess calls with ThreadPool executors to prevent `yt-dlp` from locking the server.
- [x] Implement an `asyncio.Semaphore` for `faster_whisper` transcriptions to prevent GPU/CPU OOM crashes under high load.
- [x] Add SQLite database support for Community Songs.