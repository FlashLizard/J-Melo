# Admin Dashboard & Automated Server Maintenance

J-Melo includes a secure, built-in administrative suite designed to help deployment maintainers monitor server health and automate the cleanup of temporary and cached files.

## Security

-   **Admin Token:** All admin functionalities are locked behind a Bearer Token authentication scheme. The token is defined in the `backend/config.json` file under the `admin_token` key. If this key is missing or the file is not present, all admin routes are disabled.
-   **Frontend Login:** The `/settings/admin` page on the frontend requires the user to input this token before granting access to the dashboard. The token is kept in memory and sent with subsequent requests.

## Dashboard Capabilities

The Admin Dashboard provides real-time statistics and manual overrides for the three main storage directories on the backend:
1.  **Media Cache (`media_cache/`)**: Stores `.mp3` files downloaded via `yt-dlp`.
2.  **Token Cache (`temp_data/`)**: Stores temporary JSON files generated when users Export their library.
3.  **Community Database (`shared_songs.db`)**: The SQLite database storing songs uploaded to the community.

From the dashboard, admins can view the total size (in GB/MB) and file count of these caches, and trigger a "Clear Now" action to instantly delete all files within a specific directory.

## Automated Cleanup Policies

To ensure the server does not run out of disk space, the backend runs a continuous background task (`background_cleanup_task`) every hour. This task reads the `config.json` file for administrator-defined limits.

### Configuration via UI
Admins can set these limits directly from the Frontend Dashboard, and the frontend will save them back to the server's `config.json` via the `/api/admin/config` endpoint.

### Enforcement Logic
For both the Media Cache and Token Cache, the background task enforces two constraints:
1.  **Max Age:** Any file older than the configured `max_age_days` (or `max_age_hours`) is instantly deleted.
2.  **Max Size:** After age-based pruning, if the total size of the directory still exceeds the configured `max_size_gb` (or `max_size_mb`), the task will identify the **oldest** files in the directory and delete them sequentially until the total size drops back below the quota.

This LRU (Least Recently Used) style eviction ensures that frequently accessed media remains cached while preventing unbounded disk growth.