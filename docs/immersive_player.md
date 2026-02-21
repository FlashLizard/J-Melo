# Immersive Player

The Immersive Player is the central visual and audio component of J-Melo.

## Features

-   **Streaming from Backend:** The player uses standard HTML5 Audio to stream audio files that are downloaded and served by the FastAPI backend.
-   **Visual Feedback:** The main UI features a rotating vinyl record animation that uses the album cover art fetched from the media source. The animation respects the play/pause state.
-   **Playback Controls:** Includes standard controls: Play/Pause, Seek (scrubber bar with current time and duration), and Volume/Mute controls.
-   **Offline Caching:** The player supports caching audio files directly into the browser's IndexedDB. When a song is marked as cached, the player will read the audio blob from the local database instead of requesting it from the backend, enabling offline playback and saving bandwidth.
-   **Automatic Backend Recovery:** When loading a cached song, if the frontend determines that it relies on a backend file (not stored in IndexedDB), it will perform a lightweight `HEAD` check. If the backend cache has been cleared, the player will silently instruct the backend to re-download the file before starting playback, ensuring a seamless user experience.
-   **Synced Lyrics Integration:** The player's current time is tightly coupled with the `useSongStore` and `LyricsDisplay` to drive the synchronized scrolling and highlighting of lyrics.

## Technical Details

-   Audio playback is managed primarily through the `useSongStore` state, which holds the current `audioUrl` (which can be a remote backend URL or a local `blob:` URL) and the current playback time.
-   The UI responds to changes in the `useSongStore` to update the scrubber, timestamps, and the rotating animation of the cover art.
-   Background clicks on the lyrics panel are intercepted to toggle the play/pause state, making the app highly friendly for mobile users.