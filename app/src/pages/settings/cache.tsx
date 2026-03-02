// src/pages/settings/cache.tsx
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useTranslation from '@/hooks/useTranslation';
import { db, SongRecord } from '@/lib/db';
import { filesize } from 'filesize';
import Head from 'next/head';

const CachePage: React.FC = () => {
  const { t } = useTranslation();
  const [cachedSongs, setCachedSongs] = useState<SongRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCachedSongs = async () => {
    setIsLoading(true);
    try {
      // Use filter instead of where().equals() to avoid boolean index key errors in some browsers
      const songs = await db.songs.toCollection().filter(s => !!s.is_cached).toArray();
      setCachedSongs(songs);
    } catch (err) {
      console.error("Failed to load cached songs:", err);
      setCachedSongs([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadCachedSongs();
  }, []);

  const totalSize = useMemo(() => {
    const bytes = cachedSongs.reduce((acc, song) => acc + (song.audioData?.size || 0), 0);
    return filesize(bytes, { base: 2, standard: "jedec" });
  }, [cachedSongs]);

  const handleDelete = async (id: number) => {
    if (window.confirm(t('cacheManager.deleteSongConfirm'))) {
      await db.songs.update(id, { audioData: undefined, is_cached: false });
      loadCachedSongs();
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm(t('cacheManager.deleteAllConfirm'))) {
      const ids = cachedSongs.map(s => s.id!).filter(id => id !== undefined);
      await db.songs.bulkUpdate(ids.map(id => ({ key: id, changes: { audioData: undefined, is_cached: false } })));
      loadCachedSongs();
    }
  };

  return (
    <>
      <Head>
        <title>{`J-Melo - ${t('cacheManager.title')}`}</title>
      </Head>
      <main className="bg-[#0f172a] min-h-screen text-white pb-12 selection:bg-indigo-500/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
          
          {/* Header */}
          <header className="relative z-[100] flex flex-row justify-between items-center gap-2 sm:gap-6 mb-8 bg-gray-800/40 p-3 sm:p-5 rounded-[2rem] border border-gray-700/50 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                  <div className="bg-gray-900/50 p-1.5 sm:p-2.5 rounded-2xl shadow-inner border border-gray-700/50 flex-shrink-0">
                      <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                  </div>
                  <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent truncate">{t('cacheManager.title')}</h1>
              </div>
              <Link href="/settings" className="p-2 sm:p-2.5 bg-gray-700/80 text-gray-200 rounded-xl hover:bg-gray-600 hover:text-white transition-all flex items-center justify-center border border-gray-600/50 shadow-sm flex-shrink-0" title={t('cacheManager.backToSettings')}>
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
              </Link>
          </header>

          <div className="bg-gray-800/40 backdrop-blur-sm rounded-3xl border border-gray-700/50 p-6 sm:p-8 shadow-lg mb-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div>
                      <h2 className="text-xl font-bold text-gray-200 uppercase tracking-wider mb-1">
                          {t('cacheManager.cachedSongsCount', { count: cachedSongs.length })}
                      </h2>
                      <p className="text-gray-400 text-sm">{t('cacheManager.totalSize')}: <span className="text-indigo-400 font-mono font-bold ml-1">{totalSize}</span></p>
                  </div>
                  <button
                      onClick={handleDeleteAll}
                      disabled={cachedSongs.length === 0}
                      className="w-full sm:w-auto px-6 py-2.5 bg-red-900/40 text-red-300 border border-red-800/50 rounded-xl hover:bg-red-600 hover:text-white hover:border-red-500 transition-all font-bold disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                  >
                      {t('cacheManager.deleteAllButton')}
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {isLoading ? (
                <div className="text-center py-20 text-gray-500 animate-pulse">{t('home.loadingSongs')}</div>
            ) : cachedSongs.length > 0 ? (
              cachedSongs.map(song => (
                <div key={song.id} className="bg-gray-800/60 backdrop-blur-sm p-5 rounded-2xl border border-gray-700/50 shadow-sm flex justify-between items-center group hover:border-gray-600 transition-colors">
                  <div className="min-w-0">
                    <p className="font-bold text-lg text-white truncate pr-4">{song.title}</p>
                    <p className="text-sm text-gray-400 truncate pr-4 mt-0.5">{song.artist || t('cacheManager.unknownArtist')}</p>
                  </div>
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <span className="text-indigo-300 font-mono text-xs bg-indigo-900/20 px-2 py-1 rounded-md border border-indigo-800/30">
                      {filesize(song.audioData?.size || 0, { base: 2, standard: "jedec" })}
                    </span>
                    <button
                      onClick={() => handleDelete(song.id!)}
                      className="p-2 text-gray-400 hover:text-red-400 bg-gray-900/50 rounded-xl border border-gray-700/50 hover:border-red-500/50 transition-all"
                      title={t('cacheManager.deleteButton')}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-gray-800/20 rounded-3xl border border-gray-700/30 border-dashed">
                <p className="text-gray-500 font-medium">{t('cacheManager.noCachedSongs')}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
};

export default CachePage;