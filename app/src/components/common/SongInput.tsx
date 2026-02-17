// app/src/components/common/SongInput.tsx
import React, { useState } from 'react';
import useSongStore from '@/stores/useSongStore';
import useTranslation from '@/hooks/useTranslation';
import { useRouter } from 'next/router';

const SongInput: React.FC = () => {
  const [url, setUrl] = useState('');
  const { isLoading, error, fetchSong } = useSongStore();
  const { t } = useTranslation();
  const router = useRouter();

  const handleFetch = async () => {
    if (url) {
      const newSong = await fetchSong(url);
      if (newSong && newSong.id) {
        router.push(`/player/${newSong.id}`); // Redirect to player page after loading
      }
    }
  };

  return (
    <div className="p-4 bg-gray-800">
      <h2 className="text-white text-lg mb-2">{t('index.loadSongFromUrl')}</h2>
      <div className="flex space-x-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('index.enterSongUrl')}
          className="flex-grow p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={isLoading}
        />
        <button
          onClick={handleFetch}
          className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-bold disabled:bg-gray-500"
          disabled={isLoading}
        >
          {t('index.loadButton')}
        </button>
      </div>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
};

export default SongInput;
