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
import toast from 'react-hot-toast';
import cn from 'classnames';

interface DisplaySongData {
  id?: number;
  title: string;
  artist: string | null;
  cover_url?: string | null;
  is_cached?: boolean;
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
        toast.error(t('home.sharerNicknameRequiredAlert'));
        return;
    }

    setIsUploading(true);
    const loadingToast = toast.loading(t('home.uploadingButton'));

    try {
        const songsToShare = await db.songs.where('id').anyOf(selectedSongIds).toArray();
        let successCount = 0;
        let updateCount = 0;

        // Fetch user's existing shared songs to determine if we need to update/overwrite
        const existingRemoteSongsRes = await fetch(`${backendUrl}/api/community/songs?sharer=${encodeURIComponent(sharerNickname)}`);
        let remoteSongsMap = new Map<string, number>(); // title -> remote id
        if (existingRemoteSongsRes.ok) {
            const remoteData = await existingRemoteSongsRes.json();
            remoteData.songs.forEach((s: any) => {
                remoteSongsMap.set(s.title, s.id);
            });
        }

        for (const song of songsToShare) {
            const wordsToShare = await db.words.where('sourceSongId').equals(song.id!).toArray();       

            // If a song with the same title already exists on the server under this nickname, delete it first to overwrite
            if (remoteSongsMap.has(song.title)) {
                const remoteId = remoteSongsMap.get(song.title);
                await fetch(`${backendUrl}/api/community/songs/${remoteId}?sharer_name=${encodeURIComponent(sharerNickname)}`, {
                    method: 'DELETE'
                });
                updateCount++;
            }

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
                if (!remoteSongsMap.has(song.title)) {
                    successCount++;
                }
            }
        }

        let msg = '';
        if (successCount > 0) msg += `Shared ${successCount} new. `;
        if (updateCount > 0) msg += `Updated ${updateCount} existing.`;
        if (!msg) msg = "Operation completed.";

        toast.success(msg, { id: loadingToast });
        setIsSelectMode(false);
        setSelectedSongIds([]);
    } catch (e) {
        toast.error(t('home.uploadErrorAlert', { error: (e as Error).message }), { id: loadingToast });
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
        <div className="flex flex-col items-center gap-4">
            <svg className="animate-spin h-10 w-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p className="text-gray-400 font-medium tracking-wide animate-pulse">{t('home.loadingSongs')}</p>
        </div>
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

      <main className="bg-[#0f172a] min-h-screen text-white pb-12 selection:bg-indigo-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
            {/* Header */}
            <header className="relative z-[100] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 bg-gray-800/40 p-4 sm:p-6 rounded-3xl border border-gray-700/50 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-gray-900/50 p-2.5 rounded-2xl shadow-inner border border-gray-700/50">
                        <img src="/logo.svg" alt="J-Melo Logo" className="w-10 h-10 drop-shadow-md" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">{t('home.title')}</h1>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5 items-center w-full md:w-auto">
                    {!isSelectMode && (
                        <>
                            <button onClick={() => setIsSelectMode(true)} className="flex items-center justify-center sm:justify-start gap-1.5 px-4 py-2.5 text-sm bg-gray-700/80 rounded-xl hover:bg-gray-600 text-white font-medium transition-colors border border-gray-600/50 whitespace-nowrap">
                                <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                {t('home.selectButton')}
                            </button>
                            <Link href="/explore" className="flex items-center justify-center sm:justify-start gap-1.5 px-4 py-2.5 text-sm bg-indigo-600/90 rounded-xl hover:bg-indigo-500 text-white font-medium transition-colors border border-indigo-500/30 shadow-md shadow-indigo-900/20 whitespace-nowrap">
                                <svg className="w-4 h-4 text-indigo-200 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                                {t('home.exploreButton')}
                            </Link>
                            <Link href="/vocabulary" className="flex items-center justify-center sm:justify-start gap-1.5 px-4 py-2.5 text-sm bg-amber-600/90 rounded-xl hover:bg-amber-500 text-white font-medium transition-colors border border-amber-500/30 shadow-md shadow-amber-900/20 whitespace-nowrap">
                                <svg className="w-4 h-4 text-amber-200 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                {t('index.vocabularyButton')}
                            </Link>
                            
                            <div className="relative" ref={menuRef}>
                                <button 
                                    onClick={() => setIsMenuOpen(!isMenuOpen)} 
                                    className={cn("w-full sm:w-auto px-4 py-2.5 text-sm bg-gray-800 rounded-xl hover:bg-gray-700 text-white flex items-center justify-center gap-1.5 transition-colors border border-gray-700/50 whitespace-nowrap", isMenuOpen && "bg-gray-700")}
                                >
                                    <span>{t('home.moreMenu') || 'More'}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                
                                {isMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700/50 z-[110] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <button onClick={() => { setIsAboutOpen(true); setIsMenuOpen(false); }} className="block w-full text-left px-5 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                                            {t('home.aboutButton')}
                                        </button>
                                        <div className="border-t border-gray-700/50"></div>
                                        <button onClick={() => { handleImportClick(); setIsMenuOpen(false); }} className="block w-full text-left px-5 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                                            {t('home.importButton')}
                                        </button>
                                        <button onClick={() => { setTranscriptionModalOpen(true); setIsMenuOpen(false); }} className="block w-full text-left px-5 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                                            {t('index.transcriptionQueue')}
                                        </button>
                                        <Link href="/my-shared" onClick={() => setIsMenuOpen(false)} className="block w-full text-left px-5 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                                            {t('home.mySharedButton')}
                                        </Link>
                                        <div className="border-t border-gray-700/50"></div>
                                        <Link href="/settings" onClick={() => setIsMenuOpen(false)} className="block w-full text-left px-5 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                                            {t('index.settingsButton')}
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </header>

            {/* Song Input Area */}
            <div className="relative z-0 mb-10 max-w-3xl mx-auto">
                <SongInput />
            </div>

            {/* Select Mode Action Bar */}
            {isSelectMode && (
                <div className="bg-gray-800/80 backdrop-blur-md p-4 rounded-2xl mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] animate-in slide-in-from-top-4 fade-in duration-300 sticky top-4 z-40">
                    <div className="flex items-center bg-gray-900/50 px-4 py-2 rounded-xl border border-gray-700/50 cursor-pointer hover:bg-gray-900 transition-colors" onClick={(e) => { const cb = document.getElementById('selectAllCb'); if(cb) cb.click(); }}>
                        <input id="selectAllCb" type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="form-checkbox h-5 w-5 text-indigo-500 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-gray-900 cursor-pointer" onClick={(e) => e.stopPropagation()} />
                        <label htmlFor="selectAllCb" className="ml-3 text-sm font-medium text-gray-200 cursor-pointer">{t('home.selectAll')}</label>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                        <button onClick={handleUploadSelected} className="px-4 py-2 text-sm bg-indigo-600/90 rounded-xl hover:bg-indigo-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-500/30" disabled={selectedSongIds.length === 0 || isUploading}>
                            {isUploading ? t('home.uploadingButton') : t('home.uploadButton')}
                        </button>
                        <button onClick={handleShareSelected} className="px-4 py-2 text-sm bg-emerald-600/90 rounded-xl hover:bg-emerald-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-500/30" disabled={selectedSongIds.length === 0}>
                            {t('home.exportButton')}
                        </button>
                        <button onClick={handleDeleteSelected} className="px-4 py-2 text-sm bg-red-900/60 rounded-xl hover:bg-red-800/80 text-red-200 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-red-800/50" disabled={selectedSongIds.length === 0}>
                            {t('home.deleteButton')}
                        </button>
                        <button onClick={() => { setIsSelectMode(false); setSelectedSongIds([]); }} className="px-4 py-2 text-sm bg-gray-700 rounded-xl hover:bg-gray-600 text-gray-200 font-medium transition-all">
                            {t('home.cancelButton')}
                        </button>
                    </div>
                </div>
            )}

            {/* Song Grid */}
            {songs.length === 0 ? (
                <div className="text-center py-20 bg-gray-800/30 rounded-3xl border border-gray-700/30 border-dashed max-w-2xl mx-auto">
                    <div className="bg-gray-900/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    </div>
                    <p className="text-xl text-gray-300 font-medium mb-2">{t('home.noSongsFound')}</p>
                    <p className="text-gray-500 text-sm">{t('home.addSongsHint')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                    {songs.map((song) => {
                        const songId = song.id as number;
                        const isSelected = selectedSongIds.includes(songId);
                        
                        const CardContent = () => (
                            <div className="relative aspect-square bg-gray-700 overflow-hidden flex-shrink-0">
                                {song.cover_url ? (
                                    <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800 text-gray-500">
                                        <svg className="w-12 h-12 opacity-50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                                    </div>
                                )}
                                {/* Gradient Overlay for text readability */}
                                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300"></div>
                                
                                {/* Cached Indicator */}
                                {song.is_cached && (
                                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10 shadow-sm" title="Audio Cached Offline">
                                        <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                )}

                                {/* Song Info overlaid on image */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300 ease-out">
                                    <h2 className="text-base font-bold text-white leading-tight mb-1 line-clamp-2 drop-shadow-md">{song.title}</h2>
                                    <p className="text-xs text-gray-300 truncate drop-shadow">{song.artist || t('home.unknownArtist')}</p>
                                </div>
                            </div>
                        );

                        return (
                            <div key={songId} className={cn(
                                "group relative bg-gray-800 rounded-2xl overflow-hidden border transition-all duration-300",
                                isSelectMode ? "cursor-pointer" : "hover:-translate-y-1.5 hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.5)]",
                                isSelected ? "border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.5)] ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#0f172a]" : "border-gray-700/50 hover:border-gray-600"
                            )}>
                                {isSelectMode ? (
                                    <div onClick={() => handleSelectSong(songId)} className="h-full relative">
                                        <div className={cn("transition-all duration-200 h-full", isSelected ? 'opacity-50 scale-95 rounded-2xl overflow-hidden' : '')}>
                                            <CardContent />
                                        </div>
                                    </div>
                                ) : (
                                    <Link href={`/player/${song.id}`} className="block h-full">
                                        <CardContent />
                                    </Link>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
      </main>
    </>
  );
};

export default HomePage;
