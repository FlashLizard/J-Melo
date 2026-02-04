## 6. Advanced "Explain Word" and Vocabulary Card Creation

The "AI Tutor" has been redesigned into a sophisticated "Explain Word" and vocabulary card creation tool.

### Features:
- **Contiguous Word Selection**: Within the "Explain Word" panel, users can select a continuous range of words from the current lyric sentence for explanation.
- **Customizable LLM Prompts**:
  - Users can craft and edit the prompt sent to the LLM for word explanations.
  - Prompts support dynamic placeholders: `{word}`, `{reading}`, `{sentence}`, `{song_title}`, `{song_artist}`.
  - Users can save, load, and set default prompt templates.
- **Vocabulary Card Editor**:
  - A dedicated modal allows for the creation of new vocabulary flashcards.
  - Users can define separate templates for the front and back of the card.
  - Card templates support placeholders like `{word}`, `{sentence}`, `{reading}`, and `{llm_response}`.
  - The front can, for example, show the word in the context of the sentence, while the back shows the reading and the LLM's explanation.
  - This template system is also fully customizable, allowing users to save, load, and set default card formats.
- **Flexible Vocabulary Storage**: The database is updated to store the distinct front and back content for each vocabulary card, enabling rich and customizable exports (e.g., for Anki).