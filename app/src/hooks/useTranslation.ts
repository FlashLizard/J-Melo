// src/hooks/useTranslation.ts
import { useState, useEffect, useCallback } from 'react';
import useSettingsStore from '@/stores/useSettingsStore';

// Define a type for your translation files
type Translations = Record<string, string>;
type InterpolationOptions = { [key: string]: any };

const useTranslation = () => {
  const { settings, loadSettings } = useSettingsStore();
  const [translations, setTranslations] = useState<Translations>({});
  const [isFetching, setIsFetching] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load settings on mount if not already loaded
  useEffect(() => {
    if (!settings.uiLanguage) {
      loadSettings();
    }
  }, [settings.uiLanguage, loadSettings]);

  useEffect(() => {
    let isMounted = true;
    const fetchTranslations = async () => {
      setIsFetching(true);
      const lang = settings.uiLanguage || 'en';
      try {
        const response = await fetch(`/i18n/${lang}.json`);
        if (!response.ok) {
          console.error(`Failed to load translations for ${lang}. Falling back to en.`);
          const fallbackResponse = await fetch(`/i18n/en.json`);
          const data = await fallbackResponse.json();
          if (isMounted) {
              setTranslations(data);
              setIsInitialized(true);
          }
        } else {
          const data = await response.json();
          if (isMounted) {
              setTranslations(data);
              setIsInitialized(true);
          }
        }
      } catch (error) {
        console.error("Error fetching translations, falling back to English:", error);
        try {
            const fallbackResponse = await fetch(`/i18n/en.json`);
            const data = await fallbackResponse.json();
            if (isMounted) {
                setTranslations(data);
                setIsInitialized(true);
            }
        } catch (fallbackError) {
            console.error("Failed to load even fallback English translations:", fallbackError);
            if (isMounted) {
                setTranslations({});
                setIsInitialized(true);
            }
        }
      } finally {
        if (isMounted) {
            setIsFetching(false);
        }
      }
    };

    fetchTranslations();
    return () => { isMounted = false; };
  }, [settings.uiLanguage]);

  const t = useCallback((key: string, options?: InterpolationOptions): string => {
    const translatedString = translations[key] || key;

    if (options && translatedString !== key) {
      let result = translatedString;
      for (const optKey in options) {
        if (Object.prototype.hasOwnProperty.call(options, optKey)) {
          result = result.replace(new RegExp(`{{${optKey}}}`, 'g'), options[optKey]);
        }
      }
      return result;
    }

    return translatedString;
  }, [translations]);

  return { t, i18nLoading: isFetching, i18nInitialized: isInitialized, currentLanguage: settings.uiLanguage || 'en' };
};

export default useTranslation;
