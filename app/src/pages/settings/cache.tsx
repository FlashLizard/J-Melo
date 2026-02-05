// src/pages/settings/cache.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { db, SongRecord } from '@/lib/db';
import { filesize } from 'filesize';
import useTranslation from '@/hooks/useTranslation'; // Import useTranslation

const CacheManagerPage: React.FC = () => {
  const [cachedSongs, setCachedSongs] = useState<SongRecord[]>([]);
  const [totalSize, setTotalSize] = useState<string>('0 B');
  const { t } = useTranslation(); // Initialize useTranslation

  const loadCachedSongs = useCallback(async () => {
    // Fetch all songs and filter in memory by presence of audioData
    const allSongs = await db.songs.toArray();
    const currentCachedSongs = allSongs.filter(song => song.audioData && song.is_cached);
    setCachedSongs(currentCachedSongs);

    const total = currentCachedSongs.reduce((acc, song) => acc + (song.audioData?.size || 0), 0);
    setTotalSize(filesize(total, { base: 2, standard: "jedec" }) as string);
  }, []);

  useEffect(() => {
    loadCachedSongs();
  }, [loadCachedSongs]);

  const handleDelete = async (id: number) => {
    if (confirm(t('cacheManager.deleteSongConfirm'))) {
      await db.songs.update(id, { audioData: undefined, is_cached: false }); // Set is_cached to false
      loadCachedSongs();
    }
  };

  const handleDeleteAll = async () => {
    if (confirm(t('cacheManager.deleteAllConfirm'))) {
      const ids = cachedSongs.map(s => s.id!);
      // Bulk update all cached songs to remove audioData and set is_cached to false
      await db.songs.bulkUpdate(ids.map(id => ({ key: id, changes: { audioData: undefined, is_cached: false } })));
      loadCachedSongs();
    }
  };

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">{t('cacheManager.title')}</h1>
          <Link href="/settings" className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-white">
            &larr; {t('cacheManager.backToSettings')}
          </Link>
        </header>

        <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold">{t('cacheManager.cachedSongsCount', { count: cachedSongs.length })}</h2>
                    <p className="text-gray-400">{t('cacheManager.totalSize')}: {totalSize}</p>
                </div>
                <button
                    onClick={handleDeleteAll}
                    disabled={cachedSongs.length === 0}
                    className="px-4 py-2 bg-red-700 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t('cacheManager.deleteAllButton')}
                </button>
            </div>
        </div>

        <div className="space-y-4">
          {cachedSongs.length > 0 ? (
            cachedSongs.map(song => (
              <div key={song.id} className="bg-gray-800 rounded-lg shadow p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-lg">{song.title}</p>
                  <p className="text-sm text-gray-400">{song.artist || t('cacheManager.unknownArtist')}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-gray-300 font-mono text-sm">
                    {filesize(song.audioData?.size || 0, { base: 2, standard: "jedec" })}
                  </span>
                  <button
                    onClick={() => handleDelete(song.id!)}
                    className="px-3 py-1 bg-red-600 rounded-md hover:bg-red-500 text-xs"
                  >
                    {t('cacheManager.deleteButton')}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">{t('cacheManager.noCachedSongs')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CacheManagerPage;
