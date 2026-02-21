# Settings Storage

J-Melo requires configuration for various API keys and user preferences. These settings must be persistent across sessions but secure enough not to be exposed in the frontend code.

## Architecture

Settings are managed primarily through the `useSettingsStore` and persisted in the local browser using IndexedDB (via `Dexie.js`).

### The Database (`db.ts`)

The `Settings` interface defines the structure of the stored data:

```typescript
export interface Settings {
  id?: number; // Always 0, representing a singleton record
  openaiApiKey: string | null; // The default API key
  llmApiUrl: string | null;    // The default API URL
  llmModelType: string | null; // The default Model Type
  aiResponseLanguage: 'en' | 'zh';
  uiLanguage: 'en' | 'zh';

  // Tool-specific overrides
  lyricFixLLMApiKey?: string | null;
  lyricFixLLMApiUrl?: string | null;
  lyricFixLLMModelType?: string | null;
  lyricFixLLMMaxTokens?: number;
  
  translationLLMApiKey?: string | null;
  translationLLMApiUrl?: string | null;
  translationLLMModelType?: string | null;
  translationLLMMaxTokens?: number;
  targetTranslationLanguage: string;
  
  llmMaxTokens?: number; // Default max tokens
  
  // UI Preferences
  defaultPromptTemplateId?: number;
  defaultCardTemplateId?: number;
  showReadings: boolean;
  showTranslations: boolean;
  
  // App Configuration
  backendUrl: string;
  sharerNickname?: string; // Identity for community sharing
}
```

The database initializes with a robust versioning system to handle schema upgrades smoothly as new features (like tool-specific LLM settings or Max Tokens limits) are added over time.

### Loading Logic

The `loadSettings` function in `useSettingsStore` defines the priority for resolving the `backendUrl`, which is critical for the app to function:

1.  **User Preference (Highest):** If the user has manually entered and saved a `backendUrl` in the Settings UI, this value (stored in IndexedDB) takes precedence.
2.  **Deployment Default (Medium):** When the app first loads, it attempts to fetch `/config.json` from the `public/` directory. If this file exists and contains a `backendUrl`, this value becomes the baseline for the session, overriding the hardcoded default. This allows server administrators to deploy J-Melo and automatically point all new clients to their specific backend without requiring users to configure it manually.
3.  **Hardcoded Fallback (Lowest):** If the user hasn't set a URL and `/config.json` is missing or invalid, the app falls back to `http://localhost:8000`.

### Security Considerations

-   **API Keys:** API keys (OpenAI, Anthropic, etc.) are *never* sent to the J-Melo backend or stored anywhere other than the user's local IndexedDB. This ensures that users maintain complete control over their API usage and billing.
-   **Admin Token:** The token used to access the Backend Admin Dashboard is also stored locally in the frontend state (or session storage), ensuring that only authorized individuals can trigger cache clearing or quota modifications on the server.