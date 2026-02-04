// src/hooks/useTranslation.ts
import { useState, useEffect, useCallback } from 'react';
import useSettingsStore from '@/stores/useSettingsStore';

// Define a type for your translation files
type Translations = Record<string, string>;

const useTranslation = () => {
  const { settings, loadSettings } = useSettingsStore();
  const [translations, setTranslations] = useState<Translations>({});
  const [loading, setLoading] = useState(true);

  // Load settings on mount if not already loaded
  useEffect(() => {
    if (!settings.uiLanguage) {
      loadSettings();
    }
  }, [settings.uiLanguage, loadSettings]);

  useEffect(() => {
    const fetchTranslations = async () => {
      setLoading(true);
      const lang = settings.uiLanguage || 'en'; // Default to English if not set
      try {
        const response = await fetch(`/i18n/${lang}.json`);
        if (!response.ok) {
          console.error(`Failed to load translations for ${lang}. Falling back to en.`);
          const fallbackResponse = await fetch(`/i18n/en.json`);
          setTranslations(await fallbackResponse.json());
        } else {
          setTranslations(await response.json());
        }
      } catch (error) {
        console.error("Error fetching translations, falling back to English:", error);
        // Fallback to English if fetch fails
        try {
            const fallbackResponse = await fetch(`/i18n/en.json`);
            setTranslations(await fallbackResponse.json());
        } catch (fallbackError) {
            console.error("Failed to load even fallback English translations:", fallbackError);
            setTranslations({}); // Empty translations if all else fails
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTranslations();
  }, [settings.uiLanguage]); // Re-fetch when uiLanguage changes

  const t = useCallback((key: string): string => {
    return translations[key] || key; // Return key if translation not found
  }, [translations]);

  return { t, i18nLoading: loading, currentLanguage: settings.uiLanguage || 'en' };
};

export default useTranslation;
