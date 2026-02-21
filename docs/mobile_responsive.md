# Mobile Responsive Design

J-Melo is designed to be a mobile-first application, ensuring that the complex lyrics editing and AI tutoring features are accessible and usable on smaller screens.

## Layout Strategy

The application uses a responsive layout strategy based on Tailwind CSS breakpoints (`sm`, `md`, `lg`).

### Desktop View (Large Screens)
On desktop screens, the interface is split into a three-pane layout:
1.  **Player (Left):** Displays the album art, playback controls, and the main video/audio element.
2.  **Lyrics (Center):** A scrolling list of synchronized lyrics.
3.  **Tools (Right):** A dynamic panel that switches between the AI Tutor, Full Lyrics Editor, Timeless Lyrics Importer, Lyric Translation Panel, and Song Info Editor based on user interaction.

### Mobile View (Small Screens)
On mobile devices, screen real estate is limited. The layout transitions to a single-pane view managed by the `useMobileViewStore`:

-   **Swipable Navigation:** Users navigate between the three main views (Player, Lyrics, Tools) using swipe gestures. This is implemented using the `react-swipeable` library.
-   **View State:** The `useMobileViewStore` tracks the currently active view (`'player' | 'lyrics' | 'tools'`).
-   **Bottom Navigation Bar:** A sticky bottom navigation bar provides explicit buttons to switch between the three views, ensuring accessibility for users who prefer tapping over swiping.

## Component Adaptations

-   **Lyrics Display:** The lyrics display occupies the full screen width on mobile, maximizing readability.
-   **Tool Panels:** The various tool panels (AI Tutor, Editors) are designed to fit within the mobile viewport. They use vertical scrolling for content that exceeds the screen height.
-   **Modals:** All modals (e.g., `AboutModal`, `ImportConflictModal`) use a `max-h-[90vh]` class to ensure they don't extend beyond the visible screen area, with internal overflow scrolling for long content.
-   **Sentence Editor:** The visual timeline in the Sentence Editor is inherently challenging on mobile. To mitigate this, the layout adjusts to stack controls and the timeline vertically, and the "JSON Mode" is offered as an alternative for precise editing when touch interactions are difficult.