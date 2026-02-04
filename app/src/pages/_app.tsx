import '@/styles/globals.css';
import '@/lib/immer'; // Import to enable Immer plugins
import type { AppProps } from 'next/app';

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default MyApp
