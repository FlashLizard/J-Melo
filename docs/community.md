# Community Sharing & Exploration

J-Melo features a decentralized community system allowing users to share their perfectly timed lyrics and vocabulary decks with others.

## The Community Server

-   **Database Backend:** The backend maintains an SQLite database (`shared_songs.db`) that stores all songs uploaded by the community. It saves the metadata, the full lyrics JSON, and an array of all associated vocabulary cards.
-   **Upload Quotas:** To prevent server abuse, administrators can configure a maximum storage quota (e.g., `500MB`) in the backend's `config.json`. If the community database exceeds this size, the backend will reject new uploads with a `413 Payload Too Large` error.
-   **Admin Moderation:** An Admin Dashboard provides a dedicated view for administrators to list all shared songs and force-delete any inappropriate or low-quality content, bypassing ownership checks.

## Uploading (Sharing)

-   **Sharer Identity:** Before uploading, a user must define a "Sharer Nickname" in the Settings. This name will be permanently attached to any song they upload.
-   **Bulk Uploading:** From the main library (`/`), users can select multiple songs and click "Share to Community". The frontend gathers the selected songs, strips out heavy binary caches (like audio data), attaches all linked vocabulary cards, and pushes the payload to the `POST /api/community/share` endpoint.
-   **My Shared Management:** Users can visit the "My Shared" page (`/my-shared`) to view a list of all songs uploaded under their current Sharer Nickname. They can permanently delete their own uploads from the server from this page.

## Exploring and Downloading

-   **Explore Page:** The "Explore" page (`/explore`) queries the `GET /api/community/songs` endpoint. It displays a gallery of all available community songs, supporting text-based search filtering by Title or Artist.
-   **Smart Downloading:** Clicking on a song in the Explore gallery prompts the user to download it.
-   **Conflict Resolution Engine:** When downloading, the frontend checks if the `sourceUrl` of the incoming song already exists in the local IndexedDB. 
    -   If no conflict exists, the song and its vocabulary are silently saved.
    -   If a conflict is detected, the `ImportConflictModal` is triggered. This forces the user to explicitly choose how to handle the duplicate:
        1.  **Keep Existing:** Skips the download for this specific song.
        2.  **Overwrite:** Deletes the local song and all its vocabulary, replacing it entirely with the community version.
        3.  **Merge Words Only:** Keeps the local song data intact, but imports any new vocabulary cards from the community version that don't already exist locally.