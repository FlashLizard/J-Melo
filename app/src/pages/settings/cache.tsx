import React, { useState, useEffect, useMemo } from 'react';
import useTranslation from '@/hooks/useTranslation';
import { db, SongRecord } from '@/lib/db';
import { filesize } from 'filesize';
import toast from 'react-hot-toast';
import AppPageShell from '@/components/common/AppPageShell';
import EmptyState from '@/components/common/EmptyState';

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
      toast.success(t('admin.clearSuccess', { cacheName: 'Media' }));
      loadCachedSongs();
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm(t('cacheManager.deleteAllConfirm'))) {
      const ids = cachedSongs.map(s => s.id!).filter(id => id !== undefined);
      await db.songs.bulkUpdate(ids.map(id => ({ key: id, changes: { audioData: undefined, is_cached: false } })));
      toast.success(t('admin.clearSuccess', { cacheName: 'All Media' }));
      loadCachedSongs();
    }
  };

  return (
    <AppPageShell
      title={t('cacheManager.title')}
      documentTitle={`J-Melo - ${t('cacheManager.title')}`}
      backHref="/settings"
      backLabel={t('cacheManager.backToSettings')}
    >
          <div className="jm-panel p-5 sm:p-7 mb-8">
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
                <div key={song.id} className="jm-card p-5 flex justify-between items-center group hover:border-gray-600 transition-colors">
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
              <EmptyState title={t('cacheManager.noCachedSongs')} icon="music" />
            )}
          </div>
    </AppPageShell>
  );
};

export default CachePage;
