// app/src/pages/index.tsx
import Head from 'next/head';
import Link from 'next/link';
import React, { useEffect, useState, useMemo } from 'react';
import useSongStore from '@/stores/useSongStore';
import useTranslation from '@/hooks/useTranslation';
import SongInput from '@/components/common/SongInput';
import { db, blobToBase64 } from '@/lib/db';
import { saveAs } from 'file-saver';
import { SongRecord } from '@/lib/db';

interface DisplaySongData {
  id?: number;
  title: string;
  artist: string | null;
  cover_url?: string | null;
}

const HomePage = () => {
  const { fetchAllSongs, isLoading, deleteSongs, importSongs } = useSongStore();
  const [songs, setSongs] = useState<DisplaySongData[]>([]);
  const { t } = useTranslation();
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<number[]>([]);

  const loadSongs = async () => {
    const allSongs = await fetchAllSongs();
    setSongs(allSongs);
  };

  useEffect(() => {
    loadSongs();
  }, [fetchAllSongs]);

  const handleSelectSong = (songId: number) => {
    setSelectedSongIds(prev =>
      prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedSongIds(songs.map(s => s.id).filter((id): id is number => id !== undefined));
    } else {
      setSelectedSongIds([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedSongIds.length === 0) return;
    if (window.confirm(t('home.deleteConfirm', { count: selectedSongIds.length }))) {
      await deleteSongs(selectedSongIds);
      setSelectedSongIds([]);
      setIsSelectMode(false);
      loadSongs(); // Refresh the list
    }
  };

  const handleShareSelected = async () => {
    if (selectedSongIds.length === 0) return;
    const songsToShare = await db.songs.where('id').anyOf(selectedSongIds).toArray();
    const sanitizedSongs = await Promise.all(songsToShare.map(async (song) => {
        const { audioData, ...rest } = song;
        let coverImageBase64 = '';
        if (song.coverImageData) {
            coverImageBase64 = await blobToBase64(song.coverImageData);
        }
        return { ...rest, coverImageData: coverImageBase64 };
    }));
    const blob = new Blob([JSON.stringify(sanitizedSongs, null, 2)], { type: 'application/json' });
    saveAs(blob, 'j-melo-songs.json');
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        try {
          const songsData = JSON.parse(text);
          await importSongs(songsData);
          loadSongs(); // Refresh the list
          alert(t('home.importSuccess'));
        } catch (error) {
          alert(t('home.importError', { message: error.message }));
        }
      }
    };
    input.click();
  };

  const isAllSelected = useMemo(() => {
    return songs.length > 0 && selectedSongIds.length === songs.length;
  }, [selectedSongIds, songs]);
  
  if (isLoading && songs.length === 0) {
    return (
      <div className="bg-gray-900 min-h-screen text-white flex items-center justify-center">
        <p>{t('home.loadingSongs')}</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{`J-Melo - ${t('home.title')}`}</title>
      </Head>
      <main className="bg-gray-900 min-h-screen text-white p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{t('home.title')}</h1>
          <div className="flex gap-2">
            {!isSelectMode && (
                <>
                    <button onClick={handleImportClick} className="px-3 py-1 text-sm bg-purple-600 rounded-lg hover:bg-purple-500 text-white">{t('home.importButton')}</button>
                    <Link href="/vocabulary" className="px-3 py-1 text-sm bg-yellow-600 rounded-lg hover:bg-yellow-500 text-white">{t('index.vocabularyButton')}</Link>
                    <button onClick={() => setIsSelectMode(true)} className="px-3 py-1 text-sm bg-blue-600 rounded-lg hover:bg-blue-500 text-white">{t('home.selectButton')}</button>
                    <Link href="/settings" className="px-3 py-1 text-sm bg-gray-600 rounded-lg hover:bg-gray-500 text-white">{t('index.settingsButton')}</Link>
                </>
            )}
          </div>
        </div>

        {/* Add SongInput component here */}
        <SongInput />

        {isSelectMode && (
            <div className="bg-gray-800 p-2 rounded-lg mb-4 flex justify-between items-center">
                <div className="flex items-center">
                    <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="form-checkbox h-5 w-5 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"/>
                    <label className="ml-2 text-sm">{t('home.selectAll')}</label>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleShareSelected} className="px-3 py-1 text-sm bg-green-600 rounded-lg hover:bg-green-500 disabled:opacity-50" disabled={selectedSongIds.length === 0}>{t('home.shareButton')}</button>
                    <button onClick={handleDeleteSelected} className="px-3 py-1 text-sm bg-red-600 rounded-lg hover:bg-red-500 disabled:opacity-50" disabled={selectedSongIds.length === 0}>{t('home.deleteButton')}</button>
                    <button onClick={() => { setIsSelectMode(false); setSelectedSongIds([]); }} className="px-3 py-1 text-sm bg-gray-600 rounded-lg hover:bg-gray-500">{t('home.cancelButton')}</button>
                </div>
            </div>
        )}

        {songs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">{t('home.noSongsFound')}</p>
            <p className="text-gray-500">{t('home.addSongsHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {songs.map((song) => {
              const songId = song.id as number;
              const isSelected = selectedSongIds.includes(songId);
              return (
                <div key={songId} className="relative bg-gray-800 rounded-lg shadow-md overflow-hidden" onClick={() => isSelectMode && handleSelectSong(songId)}>
                  {isSelectMode ? (
                    <>
                      <div className="absolute top-2 right-2 z-10">
                        <input type="checkbox" checked={isSelected} onChange={() => handleSelectSong(songId)} className="form-checkbox h-5 w-5 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"/>
                      </div>
                      <div className={`cursor-pointer ${isSelected ? 'opacity-70' : ''}`}>
                          {song.cover_url && <img src={song.cover_url} alt={song.title} className="w-full h-48 object-cover" />}
                          <div className="p-4">
                              <h2 className="text-lg font-semibold truncate">{song.title}</h2>
                              <p className="text-sm text-gray-400 truncate">{song.artist || t('home.unknownArtist')}</p>
                          </div>
                      </div>
                    </>
                  ) : (
                    <Link href={`/player/${song.id}`} className="block hover:bg-gray-700 transition-colors duration-200">
                      {song.cover_url && (
                        <img src={song.cover_url} alt={song.title} className="w-full h-48 object-cover" />
                      )}
                      <div className="p-4">
                        <h2 className="text-lg font-semibold truncate">{song.title}</h2>
                        <p className="text-sm text-gray-400 truncate">{song.artist || t('home.unknownArtist')}</p>
                      </div>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  );
};

export default HomePage;
