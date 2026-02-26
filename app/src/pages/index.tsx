// app/src/pages/index.tsx
import Head from 'next/head';
import Link from 'next/link';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import useSongStore from '@/stores/useSongStore';
import useTranslation from '@/hooks/useTranslation';
import SongInput from '@/components/common/SongInput';
import ImportConflictModal, { Conflict } from '@/components/common/ImportConflictModal';
import AboutModal from '@/components/common/AboutModal';
import TranscriptionStatusModal from '@/components/common/TranscriptionStatusModal';
import { db, blobToBase64, WordRecord, SongRecord } from '@/lib/db';
import { saveAs } from 'file-saver';

interface DisplaySongData {
  id?: number;
  title: string;
  artist: string | null;
  cover_url?: string | null;
}

interface ImportState {
  conflicts: Conflict[];
  nonConflictingSongs: SongRecord[];
  importedWords: WordRecord[];
}

const HomePage = () => {
  const { fetchAllSongs, isLoading, deleteSongs } = useSongStore();
  const [songs, setSongs] = useState<DisplaySongData[]>([]);
  const { t } = useTranslation();
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<number[]>([]);
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isTranscriptionModalOpen, setTranscriptionModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadSongs = async () => {
    const allSongs = await fetchAllSongs();
    setSongs(allSongs);
  };

  useEffect(() => {
    loadSongs();
  }, [fetchAllSongs]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setIsMenuOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    
    // Fetch songs
    const songsToShare = await db.songs.where('id').anyOf(selectedSongIds).toArray();
    
    // Fetch words associated with these songs
    const wordsToShare = await db.words.where('sourceSongId').anyOf(selectedSongIds).toArray();

    const sanitizedSongs = await Promise.all(songsToShare.map(async (song) => {
        const { audioData, ...rest } = song;
        let coverImageBase64 = '';
        if (song.coverImageData) {
            coverImageBase64 = await blobToBase64(song.coverImageData);
        }
        return { ...rest, coverImageData: coverImageBase64 };
    }));
    
    const exportData = {
        songs: sanitizedSongs,
        words: wordsToShare
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    saveAs(blob, 'j-melo-songs.json');
  };

  const handleUploadSelected = async () => {
    if (selectedSongIds.length === 0) return;
    const settings = await db.settings.get(0);
    const backendUrl = settings?.backendUrl || 'http://localhost:8000';
    const sharerNickname = settings?.sharerNickname?.trim();

    if (!sharerNickname) {
        alert(t('home.sharerNicknameRequiredAlert'));
        return;
    }

    setIsUploading(true);
    try {
        const songsToShare = await db.songs.where('id').anyOf(selectedSongIds).toArray();
        let successCount = 0;
        
        for (const song of songsToShare) {
            const wordsToShare = await db.words.where('sourceSongId').equals(song.id!).toArray();
            
            // Prepare song payload (remove binary data, reconstruct urls if needed)
            const { audioData, ...rest } = song;
            let coverImageBase64 = '';
            if (song.coverImageData) {
                coverImageBase64 = await blobToBase64(song.coverImageData);
            }
            const songPayload = { ...rest, coverImageData: coverImageBase64 };
            
            const payload = {
                title: song.title,
                artist: song.artist,
                cover_url: song.cover_url,
                sharer_name: sharerNickname,
                song_data: songPayload,
                words_data: wordsToShare
            };

            const response = await fetch(`${backendUrl}/api/community/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.error(`Failed to upload ${song.title}`);
            } else {
                successCount++;
            }
        }
        
        alert(t('home.uploadSuccessAlert', { count: successCount, total: selectedSongIds.length }));
        setIsSelectMode(false);
        setSelectedSongIds([]);
    } catch (e) {
        alert(t('home.uploadErrorAlert', { error: (e as Error).message }));
    } finally {
        setIsUploading(false);
    }
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
          const parsedData = JSON.parse(text);
          const songsData: SongRecord[] = Array.isArray(parsedData) ? parsedData : (parsedData.songs || []);
          const wordsData: WordRecord[] = parsedData.words || [];

          const allExistingSongs = await db.songs.toArray();
          const existingUrlMap = new Map(allExistingSongs.map(s => [s.sourceUrl, s]));

          const foundConflicts: Conflict[] = [];
          const newSongs: SongRecord[] = [];

          for (const importedSong of songsData) {
            const existingSong = existingUrlMap.get(importedSong.sourceUrl);
            if (existingSong) {
              foundConflicts.push({ existingSong, importedSong });
            } else {
              newSongs.push(importedSong);
            }
          }

          if (foundConflicts.length > 0) {
            setImportState({ 
              conflicts: foundConflicts, 
              nonConflictingSongs: newSongs, 
              importedWords: wordsData 
            });
          } else {
            // No conflicts, proceed with simple import
            const { addManySongs } = useSongStore.getState();
            await addManySongs(newSongs, wordsData);
            loadSongs();
            alert(t('home.importSuccess'));
          }
        } catch (error) {
          alert(t('home.importError', { message: (error as Error).message }));
        }
      }
    };
    input.click();
  };

  const handleImportComplete = () => {
    setImportState(null);
    loadSongs();
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

      {importState && (
        <ImportConflictModal
          isOpen={!!importState}
          onClose={() => setImportState(null)}
          conflicts={importState.conflicts}
          nonConflictingSongs={importState.nonConflictingSongs}
          importedWords={importState.importedWords}
          onImportComplete={handleImportComplete}
        />
      )}

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />

      <TranscriptionStatusModal isOpen={isTranscriptionModalOpen} onClose={() => setTranscriptionModalOpen(false)} />

      <main className="bg-gray-900 min-h-screen text-white p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 relative">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="J-Melo Logo" className="w-10 h-10 drop-shadow-lg" />
            <h1 className="text-3xl font-bold">{t('home.title')}</h1>
          </div>
          <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
            {!isSelectMode && (
                <>
                    <button onClick={() => setIsSelectMode(true)} className="flex-1 sm:flex-none px-4 py-2 text-sm bg-blue-600 rounded-lg hover:bg-blue-500 text-white font-bold">{t('home.selectButton')}</button>
                    <Link href="/explore" className="flex-1 sm:flex-none px-4 py-2 text-sm bg-indigo-600 rounded-lg hover:bg-indigo-500 text-white font-bold text-center">{t('home.exploreButton')}</Link>
                    <Link href="/vocabulary" className="flex-1 sm:flex-none px-4 py-2 text-sm bg-yellow-600 rounded-lg hover:bg-yellow-500 text-white font-bold text-center">{t('index.vocabularyButton')}</Link>
                    
                    <div className="relative" ref={menuRef}>
                        <button 
                            onClick={() => setIsMenuOpen(!isMenuOpen)} 
                            className="px-3 py-2 text-sm bg-gray-700 rounded-lg hover:bg-gray-600 text-white flex items-center gap-1"
                        >
                            <span>{t('home.moreMenu') || 'More'}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                        
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg border border-gray-700 z-50 py-1">
                                <button onClick={() => { setIsAboutOpen(true); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                                    {t('home.aboutButton')}
                                </button>
                                <div className="border-t border-gray-700 my-1"></div>
                                <button onClick={() => { handleImportClick(); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                                    {t('home.importButton')}
                                </button>
                                <button onClick={() => setTranscriptionModalOpen(true)} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                                    {t('index.transcriptionQueue')}
                                </button>
                                <Link href="/my-shared" onClick={() => setIsMenuOpen(false)} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                                    {t('home.mySharedButton')}
                                </Link>
                                <div className="border-t border-gray-700 my-1"></div>
                                <Link href="/settings" onClick={() => setIsMenuOpen(false)} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                                    {t('index.settingsButton')}
                                </Link>
                            </div>
                        )}
                    </div>
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
                <div className="flex gap-2 flex-wrap justify-end">
                    <button onClick={handleUploadSelected} className="px-3 py-1 text-sm bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50" disabled={selectedSongIds.length === 0 || isUploading}>{isUploading ? t('home.uploadingButton') : t('home.uploadButton')}</button>
                    <button onClick={handleShareSelected} className="px-3 py-1 text-sm bg-green-600 rounded-lg hover:bg-green-500 disabled:opacity-50" disabled={selectedSongIds.length === 0}>{t('home.exportButton')}</button>
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
