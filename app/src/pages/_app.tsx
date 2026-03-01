import '@/styles/globals.css';
import '@/lib/immer'; // Import to enable Immer plugins
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import useSettingsStore from '@/stores/useSettingsStore';
import useTranslation from '@/hooks/useTranslation';
import useSongStore from '@/stores/useSongStore'; // Import useSongStore
import LoadingSpinner from '@/components/common/LoadingSpinner'; // Import LoadingSpinner
import PWAInstallPrompt from '@/components/common/PWAInstallPrompt';

function MyApp({ Component, pageProps }: AppProps) {
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const { i18nInitialized } = useTranslation();
  const isLoading = useSongStore((state) => state.isLoading); // Get global loading state

  useEffect(() => {
    loadSettings();
    
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(err => {
                console.log('Service Worker registration failed: ', err);
            });
        });
    }
  }, [loadSettings]);

  if (!i18nInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        Loading...
      </div>
    );
  }

  return (
    <>
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#111827" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </Head>
      {isLoading && <LoadingSpinner />}
      <Component {...pageProps} />
      <PWAInstallPrompt />
    </>
  );
}

export default MyApp