import '@/styles/globals.css';
import '@/lib/immer'; // Import to enable Immer plugins
import type { AppProps } from 'next/app';
import { useEffect } from 'react'; // Import useEffect
import useSettingsStore from '@/stores/useSettingsStore'; // Import useSettingsStore

function MyApp({ Component, pageProps }: AppProps) {
  const loadSettings = useSettingsStore((state) => state.loadSettings); // Get loadSettings action

  useEffect(() => {
    loadSettings(); // Call loadSettings when the app mounts
  }, [loadSettings]); // Depend on loadSettings to avoid re-running if it changes (though it shouldn't)

  return <Component {...pageProps} />;
}

export default MyApp