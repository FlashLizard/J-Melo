// app/src/pages/index.tsx
import Head from 'next/head';
import Link from 'next/link';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import useSongStore from '@/stores/useSongStore';
import { useRouter } from 'next/router';
import useTranslation from '@/hooks/useTranslation';
import SongInput from '@/components/common/SongInput';
import ImportConflictModal, { Conflict } from '@/components/common/ImportConflictModal';
import AboutModal from '@/components/common/AboutModal';
import TranscriptionStatusModal from '@/components/common/TranscriptionStatusModal';
import { db, blobToBase64, WordRecord, SongRecord } from '@/lib/db';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';
import cn from 'classnames';
import { motion, AnimatePresence } from 'framer-motion';

// Views
import SongLibraryView from '@/components/library/SongLibraryView';
import ExploreView from '@/components/explore/ExploreView';
import VocabularyView from '@/components/vocabulary/VocabularyView';
import MySharedPanel from '@/components/explore/MySharedPanel';
import useVocabularyStore from '@/stores/useVocabularyStore';

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

type MainTab = 'library' | 'explore' | 'vocabulary';

// Move TabButton outside to prevent re-creation and jarring Framer Motion animations
const TabButton = ({ isActive, onClick, label }: { isActive: boolean, onClick: () => void, label: string }) => (
    <button 
        onClick={onClick}
        className={cn(
            "relative px-4 sm:px-6 py-2 text-sm font-bold transition-colors duration-300 flex-shrink-0 z-10",
            isActive ? "text-white" : "text-gray-500 hover:text-gray-300"
        )}
    >
        <span className="relative z-20 whitespace-nowrap">{label}</span>
        {isActive && (
            <motion.div 
                layoutId="activeTabIndicator"
                className="absolute inset-0 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-900/40 z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
        )}
    </button>
);

const HomePage = () => {
  const { fetchAllSongs, isLoading, deleteSongs } = useSongStore();
  const { loadWordsAndSongs } = useVocabularyStore();
  const [songs, setSongs] = useState<DisplaySongData[]>([]);
  const { t } = useTranslation();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<MainTab>('library');
  
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<number[]>([]);
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isTranscriptionModalOpen, setTranscriptionModalOpen] = useState(false);
  const [isMySharedOpen, setIsMySharedOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [activeInputMode, setActiveInputMode] = useState<'none' | 'url' | 'search' | 'import'>('none');
  const [isFabOpen, setIsFabOpen] = useState(false);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressTriggered, setIsLongPressTriggered] = useState(false);
  const startPos = useRef<{ x: number, y: number } | null>(null);

  const loadSongs = async () => {
    const allSongs = await fetchAllSongs();
    setSongs(allSongs);
  };

  useEffect(() => {
    loadSongs();
    loadWordsAndSongs(); // Pre-load
  }, [fetchAllSongs, loadWordsAndSongs]);

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
    const songsToShare = await db.songs.where('id').anyOf(selectedSongIds).toArray();
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

        const existingRemoteSongsRes = await fetch(`${backendUrl}/api/community/songs?sharer=${encodeURIComponent(sharerNickname)}`);
        let remoteSongsMap = new Map<string, number>();
        if (existingRemoteSongsRes.ok) {
            const remoteData = await existingRemoteSongsRes.json();
            remoteData.songs.forEach((s: any) => {
                remoteSongsMap.set(s.title, s.id);
            });
        }

        for (const song of songsToShare) {
            const wordsToShare = await db.words.where('sourceSongId').equals(song.id!).toArray();       

            if (remoteSongsMap.has(song.title)) {
                const remoteId = remoteSongsMap.get(song.title);
                await fetch(`${backendUrl}/api/community/songs/${remoteId}?sharer_name=${encodeURIComponent(sharerNickname)}`, {
                    method: 'DELETE'
                });
                updateCount++;
            }

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

  // Long press handlers
  const handlePointerDown = (e: React.PointerEvent, id: number) => {
    if (isSelectMode || activeTab !== 'library') return;
    setIsLongPressTriggered(false);
    startPos.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      setIsSelectMode(true);
      handleSelectSong(id);
      setIsLongPressTriggered(true);
      if (typeof window !== 'undefined' && window.navigator.vibrate) {
          window.navigator.vibrate(50);
      }
    }, 600);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPos.current || !longPressTimer.current) return;
    const dist = Math.sqrt(
      Math.pow(e.clientX - startPos.current.x, 2) + 
      Math.pow(e.clientY - startPos.current.y, 2)
    );
    if (dist > 10) { // If moved more than 10px, cancel long press
      handlePointerUpOrLeave();
    }
  };

  const handlePointerUpOrLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    startPos.current = null;
  };

  const handleCardAction = (id: number) => {
    if (isSelectMode) {
        handleSelectSong(id);
    } else if (!isLongPressTriggered) {
        router.push(`/player/${id}`);
    }
    setIsLongPressTriggered(false);
  };
  
  if (isLoading && songs.length === 0) {
    return (
      <div className="bg-[#0f172a] min-h-screen text-white flex items-center justify-center">
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

      {isMySharedOpen && <MySharedPanel onClose={() => setIsMySharedOpen(false)} />}

      <main className="bg-[#0f172a] min-h-screen text-white pb-24 selection:bg-indigo-500/30 overflow-x-hidden">
        {/* Unified Fixed Navigation Bar */}
        <div className="fixed top-0 left-0 right-0 z-[100] w-full bg-[#0f172a]/95 backdrop-blur-xl border-b border-gray-700/50 shadow-2xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-row justify-between items-center h-16 sm:h-20 gap-2 sm:gap-6">
                    {/* Logo & Title */}
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <div className="bg-gray-900/50 p-1.5 sm:p-2 rounded-xl border border-gray-700/50 flex-shrink-0 shadow-inner">
                            <img src="/logo.svg" alt="J-Melo Logo" className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-md" />
                        </div>
                        <h1 className="hidden xs:block text-lg sm:text-2xl font-extrabold tracking-tight bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent truncate">J-Melo</h1>
                    </div>

                    {/* Tabs Area */}
                    <div className="flex items-center bg-gray-900/40 p-1 rounded-2xl border border-gray-700/30 relative flex-shrink-0">
                        <TabButton 
                            isActive={activeTab === 'library'}
                            onClick={() => { setActiveTab('library'); setIsSelectMode(false); }}
                            label="曲库"
                        />
                        <TabButton 
                            isActive={activeTab === 'explore'}
                            onClick={() => { setActiveTab('explore'); setIsSelectMode(false); }}
                            label="探索"
                        />
                        <TabButton 
                            isActive={activeTab === 'vocabulary'}
                            onClick={() => { setActiveTab('vocabulary'); setIsSelectMode(false); }}
                            label="词库"
                        />
                    </div>
                    
                    {/* More Menu */}
                    <div className="relative flex-shrink-0" ref={menuRef}>
                        <button 
                            onClick={() => setIsMenuOpen(!isMenuOpen)} 
                            className={cn("p-2.5 sm:px-4 sm:py-2 bg-gray-800 rounded-xl hover:bg-gray-700 text-white flex items-center justify-center transition-colors border border-gray-700/50 shadow-sm", isMenuOpen && "bg-gray-700")}
                        >
                            <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        
                        <AnimatePresence>
                            {isMenuOpen && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 mt-3 w-56 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700/50 z-[110] overflow-hidden"
                                >
                                    <button onClick={() => { setIsAboutOpen(true); setIsMenuOpen(false); }} className="block w-full text-left px-5 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                                        {t('home.aboutButton')}
                                    </button>
                                    <div className="border-t border-gray-700/50"></div>
                                    <button onClick={() => { setTranscriptionModalOpen(true); setIsMenuOpen(false); }} className="block w-full text-left px-5 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                                        {t('index.transcriptionQueue')}
                                    </button>
                                    <button onClick={() => { setIsMySharedOpen(true); setIsMenuOpen(false); }} className="block w-full text-left px-5 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                                        {t('home.mySharedButton')}
                                    </button>
                                    <div className="border-t border-gray-700/50"></div>
                                    <Link href="/settings" onClick={() => setIsMenuOpen(false)} className="block w-full text-left px-5 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                                        {t('index.settingsButton')}
                                    </Link>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>

        {/* Content Area with Top Padding for Fixed Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28">
            {/* Select Mode Action Bar (Only for Library) */}
            {isSelectMode && activeTab === 'library' && (
                <div className="bg-gray-800/80 backdrop-blur-md p-4 rounded-2xl mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] animate-in slide-in-from-top-4 fade-in duration-300 fixed top-[72px] sm:top-[88px] left-4 right-4 sm:left-auto sm:right-8 z-40">
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

            {/* Dynamic View Content */}
            <div className="min-h-[60vh]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'library' && (
                            <SongLibraryView 
                                songs={songs}
                                isSelectMode={isSelectMode}
                                selectedSongIds={selectedSongIds}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUpOrLeave={handlePointerUpOrLeave}
                                handleCardAction={handleCardAction}
                                handleSelectSong={handleSelectSong}
                                setIsSelectMode={setIsSelectMode}
                                t={t}
                            />
                        )}
                        {activeTab === 'explore' && <ExploreView />}
                        {activeTab === 'vocabulary' && <VocabularyView />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>

        {/* Floating Action Button and Fullscreen Input Panels */}
        <div className="fixed bottom-6 right-6 z-[150] flex flex-col items-end gap-4">
            <AnimatePresence>
                {activeInputMode !== 'none' && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[160] flex items-start justify-center bg-black/60 backdrop-blur-md p-4 sm:p-6 pt-12 sm:pt-20"
                        onClick={() => setActiveInputMode('none')}
                    >
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="w-full max-w-2xl max-h-[90vh] flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-gray-800 border border-gray-700 w-full flex flex-col rounded-[2.5rem] shadow-2xl overflow-hidden text-white">
                                <div className="flex justify-between items-center p-6 border-b border-gray-700/30 bg-gray-900/30 flex-shrink-0">
                                    <h3 className="font-bold text-xl text-indigo-300 flex items-center gap-3">
                                        {activeInputMode === 'url' ? (
                                            <><svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826L10.242 10.242m-4.242 4.242l4.242-4.242M9.828 5.172a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102 1.101m.758-4.826L13.758 13.758" /></svg>{t('index.loadFromUrl')}</>
                                        ) : activeInputMode === 'search' ? (
                                            <><svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>{t('index.platformYoutube')}</>
                                        ) : (
                                            <><svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>{t('home.importButton')}</>
                                        )}
                                    </h3>
                                    <button onClick={() => setActiveInputMode('none')} className="p-2.5 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-full transition-colors">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="flex-grow overflow-y-auto custom-scrollbar">
                                    <SongInput initialMode={activeInputMode === 'search' ? 'search' : 'url'} onComplete={() => { setActiveInputMode('none'); loadSongs(); }} />
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative flex flex-col items-end gap-3">
                <AnimatePresence>
                    {isFabOpen && activeInputMode === 'none' && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.8 }}
                            className="flex flex-col items-end gap-3 mb-2"
                        >
                            <button 
                                onClick={() => { setActiveInputMode('import'); setIsFabOpen(false); }}
                                className="flex items-center gap-3 px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-xl font-bold transition-all border border-blue-500/30 whitespace-nowrap"
                            >
                                <span>{t('home.importButton')}</span>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            </button>
                            <button 
                                onClick={() => { setActiveInputMode('url'); setIsFabOpen(false); }}
                                className="flex items-center gap-3 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-xl font-bold transition-all border border-emerald-500/30 whitespace-nowrap"
                            >
                                <span>{t('index.loadFromUrl')}</span>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826L10.242 10.242m-4.242 4.242l4.242-4.242M9.828 5.172a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102 1.101m.758-4.826L13.758 13.758" /></svg>
                            </button>
                            <button 
                                onClick={() => { setActiveInputMode('search'); setIsFabOpen(false); }}
                                className="flex items-center gap-3 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-xl font-bold transition-all border border-indigo-500/30 whitespace-nowrap"
                            >
                                <span>{t('index.platformYoutube')}</span>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.button
                    onClick={() => {
                        if (activeInputMode !== 'none') {
                            setActiveInputMode('none');
                        } else {
                            setIsFabOpen(!isFabOpen);
                        }
                    }}
                    animate={{ rotate: isFabOpen || activeInputMode !== 'none' ? 135 : 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-colors border-2 text-white",
                        isFabOpen || activeInputMode !== 'none' ? "bg-red-600 border-red-500" : "bg-indigo-600 border-indigo-500 hover:bg-indigo-500"
                    )}
                >
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                </motion.button>
            </div>
        </div>
      </main>
    </>
  );
};

export default HomePage;