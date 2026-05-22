import '@/styles/globals.css';
import '@/lib/immer';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import useSettingsStore from '@/stores/useSettingsStore';
import useTranslation from '@/hooks/useTranslation';
import useSongStore from '@/stores/useSongStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PWAInstallPrompt from '@/components/common/PWAInstallPrompt';
import { Toaster } from 'react-hot-toast';

const registerPwaServiceWorker = () => {
  if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return undefined;

  const register = () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        registration.update().catch(() => undefined);
      })
      .catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });
  };

  if (document.readyState === 'complete') {
    register();
    return undefined;
  }

  window.addEventListener('load', register, { once: true });
  return () => window.removeEventListener('load', register);
};

function MyApp({ Component, pageProps }: AppProps) {
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const themeMode = useSettingsStore((state) => state.settings.themeMode);
  const { i18nInitialized } = useTranslation();
  const isLoading = useSongStore((state) => state.isLoading);
  const isLightMode = themeMode === 'light';

  useEffect(() => {
    loadSettings();
    return registerPwaServiceWorker();
  }, [loadSettings]);

  if (!i18nInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        J-Melo
      </div>
    );
  }

  return (
    <>
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={isLightMode ? '#f5f7fb' : '#111318'} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="J-Melo" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>
      {isLoading && <LoadingSpinner />}
      <Component {...pageProps} />
      <PWAInstallPrompt />
      <Toaster 
        position="bottom-center"
        toastOptions={{
          style: {
            background: isLightMode ? '#ffffff' : '#374151',
            color: isLightMode ? '#172033' : '#fff',
            border: isLightMode ? '1px solid #d8e0ea' : '1px solid rgba(75, 85, 99, 0.7)',
            borderRadius: '12px',
            boxShadow: isLightMode ? '0 14px 36px rgba(15, 23, 42, 0.12)' : undefined,
          },
        }}
      />
    </>
  );
}

export default MyApp
