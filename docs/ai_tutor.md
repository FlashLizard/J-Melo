# AI Tutor

The AI Tutor is a core feature of J-Melo, designed to provide contextual explanations for Japanese words and phrases found in the lyrics.

## Features

-   **Interactive Word Selection:** Users can click and select any sequence of tokens (words) directly from the scrolling lyrics display within the player.
-   **Context-Aware Explanations:** When a word is selected, the AI Tutor sends the selected word, its reading, and the entire sentence it belongs to, along with the song title and artist, to a configured Large Language Model (LLM). This ensures the explanation is relevant to how the word is used in the specific song.
-   **Customizable Prompt Templates:** Users can define and save multiple prompt templates for the LLM. This allows them to customize the output format (e.g., requesting part of speech, dictionary forms, example sentences, or translations in a specific style). Placeholders like `{word}`, `{reading}`, `{sentence}`, `{song_title}`, and `{song_artist}` are dynamically replaced before the request is sent.
-   **Direct Vocabulary Integration:** After generating an explanation, users can review it and click "Save to Vocabulary". This opens a Card Editor where they can finalize the front and back of a flashcard before saving it to the built-in Spaced Repetition System (SRS).
-   **Multiple LLM Configuration Profiles:** The system now supports configuring separate `max_tokens`, `api_url`, and `model` settings specifically for the Tutor feature, independent of the Translation or Correction tools, allowing for optimized cost and performance.

## Data Flow

1.  User selects tokens in the `LyricsDisplay` component.
2.  The selection is passed to the `useTutorStore`.
3.  The `AIPanel` component reflects the selection and allows the user to trigger an explanation using the currently selected Prompt Template.
4.  The `useTutorStore` sends a request to the configured LLM API (e.g., OpenAI).
5.  The response is displayed in the `AIPanel`.
6.  The user can then trigger the `VocabCardEditor` to save the information to the `words` table in IndexedDB via `useVocabularyStore`.