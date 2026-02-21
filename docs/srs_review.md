# Spaced Repetition System (SRS) Review Mode

J-Melo's core philosophy is to integrate Japanese learning with media consumption. The Spaced Repetition System (SRS) bridges the gap between passive listening and active recall.

## Setup & Scope

Users can initiate a review session directly from the Vocabulary page. Before starting, a `ReviewSetup` modal asks the user to define the scope of their session:
1.  **Review All:** Includes every word ever saved across all songs.
2.  **Review by Song:** A multi-select list of all songs containing at least one vocabulary word. Users can focus their study session on a specific track they are currently listening to.

## The Algorithm

The SRS uses a weighted random selection algorithm, prioritizing words the user struggles with:
-   Each `WordRecord` in the database has a `proficiency` score (defaulting to 0).
-   When `drawNextCard()` is called, the system calculates a weight for every word in the active review pool using the formula: `weight = max(1, 100 - proficiency)`.
-   This means words with lower (or negative) proficiency scores have a significantly higher probability of being drawn next, ensuring users focus on their weak points.

## The Review Interface

1.  **Front of Card:** Displays the main Japanese word (`surface`). Users attempt to recall the reading and meaning from memory.
2.  **Show Back:** Clicking the central button reveals the back of the card, displaying the Hiragana reading (`reading`), any LLM explanations generated when the word was saved, and the original context sentence from the song.
3.  **Self-Assessment:** Users rate their recall performance using a set of color-coded buttons.

## Proficiency Updates

The user's rating directly impacts the word's `proficiency` score:
-   **Lowest:** Decreases the score by a large margin (e.g., -10).
-   **-5 / -1:** Smaller penalties for partial recall.
-   **+1 / +5:** Incremental increases for successful but hesitant recall.
-   **Highest:** Increases the score significantly (e.g., +10) for immediate, confident recall.

The updated score is immediately saved to the IndexedDB, instantly changing the probability of that word appearing in subsequent draws. When the review session concludes, the user is presented with a summary and returned to the vocabulary list.