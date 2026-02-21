# Smart Lyrics System

The Smart Lyrics System in J-Melo is a comprehensive suite of tools for displaying, editing, fixing, and translating synchronized Japanese lyrics.

## Core Data Structure

All lyrics are represented as an array of `LyricLine` objects:

```typescript
interface LyricLine {
  id: string;          // Unique identifier
  startTime: number;   // Start time of the sentence in seconds
  endTime: number;     // End time of the sentence in seconds
  text: string;        // Full Japanese text
  translation?: string;// Optional translation (e.g., Chinese)
  tokens: LyricToken[];// Array of individual words within the sentence
}

interface LyricToken {
  surface: string;     // The original word text
  reading: string;     // The Hiragana reading (Furigana)
  romaji?: string;     // Optional Romaji representation
  startTime: number;   // Precise start time of the word
  endTime: number;     // Precise end time of the word
}
```

## Front-End Processing (Kuroshiro)
When raw Japanese text is received (either pasted or transcribed), the frontend utilizes `kuroshiro` (with `kuromoji` analyzer) to automatically parse the Kanji into Hiragana (`reading`) and Romaji. This happens entirely in the browser.

## Editing Tools

1.  **Visual Sentence Editor:**
    -   Provides a graphical timeline (using `react-draggable`) to adjust the `startTime` and `endTime` of individual words within a sentence.
    -   Includes playback controls to loop over the specific sentence being edited.
    -   Allows adding, deleting, and modifying the text/reading of specific tokens.
    -   Includes a "JSON mode" toggle to edit the raw data of the single line, featuring strict validation to prevent structural corruption.

2.  **Full JSON Editor:**
    -   A power-user tool providing a raw textarea to edit the entire array of `LyricLine` objects.
    -   Validates the JSON structure before allowing saves.

3.  **AI Lyric Corrector:**
    -   Used to fix timing issues or hallucinated text from automatic transcriptions.
    -   Users paste the *correct* plain text lyrics.
    -   The system sends the correct text + the original faulty JSON to an LLM, asking it to output a new JSON array with the correct text mapped to the existing timestamps.
    -   Includes an Error Recovery UI: If the LLM returns malformed JSON, the user is presented with the raw output and can manually fix the syntax before hitting "Re-validate".

4.  **Timeless Lyrics Importer:**
    -   Allows users to paste raw, un-timed Japanese lyrics.
    -   Uses an LLM to automatically structure the text into `LyricLine` and `LyricToken` objects with `startTime` and `endTime` set to `0`.
    -   Supports a dual-mode interface allowing users to either generate structure via LLM or directly paste a pre-parsed JSON array.

5.  **Lyric Translation Panel:**
    -   Supports two modes of operation:
        -   **Translate Current Lyrics:** Sends the existing timed Japanese JSON to the LLM and asks it to fill in the `translation` fields based on a configurable target language.
        -   **Map Provided Translations:** The user pastes pre-existing translations (one line per Japanese line), and the LLM maps them into the JSON structure.
    -   Features a dedicated `max_tokens` configuration in Settings to accommodate long song translations without truncation.
    -   Includes a direct JSON import mode for bypassing the LLM entirely.