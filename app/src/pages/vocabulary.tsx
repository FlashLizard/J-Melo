// src/pages/vocabulary.tsx
import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useVocabularyStore, { VocabDisplayMode } from '@/stores/useVocabularyStore';
import { WordRecord, SongRecord } from '@/lib/db';
import cn from 'classnames';
import CardViewer from '@/components/vocabulary/CardViewer';
import ReviewSetup from '@/components/vocabulary/ReviewSetup';
import Reviewer from '@/components/vocabulary/Reviewer';
import useTranslation from '@/hooks/useTranslation';

const VocabularyPage = () => {
  const { 
    words, songs, displayMode, searchQuery, selectedIds, isSelectionMode,
    isReviewing,
    loadWordsAndSongs, setDisplayMode, setSearchQuery, toggleSelectionMode, 
    toggleIdSelection, selectBySongId, selectAll, deselectAll, deleteSelected,
    exportSelectedToAnki
  } = useVocabularyStore();

  const [isReviewSetupOpen, setIsReviewSetupOpen] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  // Handle return to player logic
  useEffect(() => {
    if (!isReviewing && router.query.returnToPlayer) {
        const songId = router.query.returnToPlayer;
        // Clear the query param and go back to player
        router.replace(`/player/${songId}`);
    }
  }, [isReviewing, router.query.returnToPlayer, router]);

  useEffect(() => {
    loadWordsAndSongs();
  }, [loadWordsAndSongs]);

  const songMap = useMemo(() => {
    const map = new Map<number, SongRecord>();
    songs.forEach(song => map.set(song.id!, song));
    return map;
  }, [songs]);

  const filteredWords = useMemo(() => {
    if (displayMode === 'search') {
      return words.filter(word => word.surface.toLowerCase().includes(searchQuery.toLowerCase()) || word.reading.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return words;
  }, [words, displayMode, searchQuery]);

  const wordsBySong = useMemo(() => {
    if (displayMode !== 'bySong') return null;
    const grouped = new Map<number, WordRecord[]>();
    filteredWords.forEach(word => {
      const songWords = grouped.get(word.sourceSongId) || [];
      songWords.push(word);
      grouped.set(word.sourceSongId, songWords);
    });
    return Array.from(grouped.entries()).map(([songId, words]) => ({
      song: songMap.get(songId),
      words,
    }));
  }, [filteredWords, displayMode, songMap]);

  const isAllSelected = selectedIds.size > 0 && selectedIds.size === filteredWords.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  };

  const handleExport = () => {
    exportSelectedToAnki(t);
  };

  if (isReviewing) {
    return (
      <main className="bg-gray-900 min-h-screen text-white">
        <Reviewer />
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>{t('vocabularyPage.documentTitle')}</title>
      </Head>
      {isReviewSetupOpen && <ReviewSetup onClose={() => setIsReviewSetupOpen(false)} />}
      <main className="bg-gray-900 min-h-screen text-white p-4 lg:p-8">
        <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-2rem)] lg:h-[calc(100vh-4rem)]">
          {/* Header */}
          <div className="flex justify-between items-center mb-8 flex-shrink-0">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="J-Melo Logo" className="w-10 h-10 drop-shadow-lg" />
              <h1 className="text-3xl font-bold tracking-tight">{t('vocabularyPage.title')}</h1>
            </div>
            <Link href="/" className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-2 font-medium">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              <span className="hidden sm:inline">{t('vocabularyPage.backToPlayer')}</span>
            </Link>
          </div>

          {/* Controls Bar */}
          <div className="bg-gray-800/80 backdrop-blur-md p-4 rounded-2xl mb-6 flex flex-col md:flex-row gap-4 items-center justify-between border border-gray-700/50 shadow-lg flex-shrink-0">
            
            {/* View Modes */}
            <div className="flex bg-gray-900/80 p-1 rounded-xl w-full md:w-auto">
              <DisplayModeButton mode="all" current={displayMode} set={setDisplayMode} t={t} />
              <DisplayModeButton mode="bySong" current={displayMode} set={setDisplayMode} t={t} />
              <DisplayModeButton mode="search" current={displayMode} set={setDisplayMode} t={t} />
            </div>

            {/* Search Input */}
            {displayMode === 'search' && (
              <div className="relative w-full md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input 
                    type="text"
                    placeholder={t('vocabularyPage.searchWordsPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-gray-900/50 text-white border border-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              {isSelectionMode ? (
                <>
                  <button onClick={deleteSelected} className="px-4 py-2 bg-red-900/50 text-red-400 border border-red-800 rounded-xl hover:bg-red-800 transition-colors text-sm font-medium disabled:opacity-50" disabled={selectedIds.size === 0}>
                    {t('vocabularyPage.deleteButton')} ({selectedIds.size})
                  </button>
                  <button onClick={handleExport} className="px-4 py-2 bg-blue-900/50 text-blue-400 border border-blue-800 rounded-xl hover:bg-blue-800 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2" disabled={selectedIds.size === 0}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span className="hidden sm:inline">{t('vocabularyPage.exportButton')}</span>
                  </button>
                  <button onClick={toggleSelectionMode} className="px-4 py-2 bg-gray-700 rounded-xl hover:bg-gray-600 text-sm font-medium transition-colors">
                    {t('vocabularyPage.cancelButton')}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsReviewSetupOpen(true)} className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 text-sm font-bold shadow-md transition-all active:scale-95 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    {t('vocabularyPage.reviewWordsButton')}
                  </button>
                  <button onClick={toggleSelectionMode} className="p-2 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-colors" title={t('vocabularyPage.selectButton')}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Main Content Area - Scrollable */}
          <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 pb-10 space-y-3">
            {isSelectionMode && displayMode !== 'bySong' && (
              <div className="flex items-center px-4 py-2 bg-gray-800/50 rounded-xl border border-gray-700/50 mb-4 sticky top-0 z-10 backdrop-blur-sm">
                <input 
                    type="checkbox" 
                    checked={isAllSelected} 
                    onChange={handleSelectAll} 
                    className="h-5 w-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-900 cursor-pointer transition-colors" 
                />
                <label className="ml-3 text-sm font-medium text-gray-300 cursor-pointer select-none" onClick={handleSelectAll}>{t('vocabularyPage.selectAllLabel')}</label>
              </div>
            )}
            
            {displayMode === 'all' || displayMode === 'search' ? (
              filteredWords.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredWords.map(word => <WordCard key={word.id} word={word} song={songMap.get(word.sourceSongId)} t={t} />)}
                  </div>
              ) : (
                  <div className="text-center py-20 text-gray-500">
                      <svg className="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                      <p>No words found.</p>
                  </div>
              )
            ) : null}

            {displayMode === 'bySong' && wordsBySong?.map(({ song, words }) => (
              <SongGroup key={song?.id} song={song} words={words} t={t} />
            ))}
          </div>
        </div>
        <CardViewer />
      </main>
    </>
  );
};

const DisplayModeButton = ({ mode, current, set, t }: { mode: VocabDisplayMode, current: VocabDisplayMode, set: (mode: VocabDisplayMode) => void, t: (key: string) => string }) => (
  <button 
    onClick={() => set(mode)} 
    className={cn("flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize", 
        current === mode ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
    )}
  >
    {mode === 'bySong' ? t('vocabularyPage.bySongMode') : mode === 'all' ? t('vocabularyPage.allMode') : t('vocabularyPage.searchMode')}
  </button>
);

const WordCard = ({ word, song, t }: { word: WordRecord, song?: SongRecord, t: (key: string) => string }) => {
  const { isSelectionMode, selectedIds, toggleIdSelection, openViewer, words } = useVocabularyStore();
  
  const handleClick = () => {
    if (!isSelectionMode) {
      const index = words.findIndex(w => w.id === word.id);
      openViewer(words, index);
    } else {
      toggleIdSelection(word.id!);
    }
  };

  const getProficiencyStyle = (p: number) => {
    if (p < 0) return 'bg-red-500/10 text-red-400 border-red-500/30';
    if (p === 0) return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    if (p <= 10) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    if (p <= 30) return 'bg-green-500/10 text-green-400 border-green-500/30';
    return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  };

  return (
    <div 
        onClick={handleClick} 
        className={cn(
            "bg-gray-800/80 p-4 rounded-xl flex items-center gap-4 transition-all duration-200 border", 
            isSelectionMode && selectedIds.has(word.id!) ? "border-blue-500 bg-blue-900/20" : "border-gray-700/50 hover:bg-gray-700 hover:border-gray-600 cursor-pointer shadow-sm hover:shadow"
        )}
    >
      {isSelectionMode && (
          <div className="flex-shrink-0">
            <input type="checkbox" checked={selectedIds.has(word.id!)} onChange={() => {}} className="h-5 w-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-900 pointer-events-none" />
          </div>
      )}
      <div className="flex-grow min-w-0">
        <div className="flex items-baseline gap-3 mb-1">
            <p className="font-bold text-lg text-white truncate">{word.surface}</p>
            <p className="text-sm text-gray-400 truncate">{word.reading}</p>
        </div>
        <div className="flex items-center justify-between mt-2">
            {song ? (
                <p className="text-xs text-gray-500 truncate flex items-center gap-1 max-w-[70%]">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    {song.title}
                </p>
            ) : <div></div>}
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-bold font-mono", getProficiencyStyle(word.proficiency || 0))}>
                {word.proficiency || 0}
            </span>
        </div>
      </div>
    </div>
  );
};

const SongGroup = ({ song, words, t }: { song?: SongRecord, words: WordRecord[], t: (key: string) => string }) => {
  const [isOpen, setIsOpen] = useState(true);
  const { isSelectionMode, selectedIds, selectBySongId } = useVocabularyStore();
  
  const wordsInThisSongIds = useMemo(() => words.map(w => w.id!), [words]);
  const areAllWordsInSongSelected = useMemo(() => wordsInThisSongIds.every(id => selectedIds.has(id)), [wordsInThisSongIds, selectedIds]);

  const handleGroupSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectBySongId(song!.id!, e.target.checked);
  };
  
  return (
    <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden mb-4">
      <header 
        onClick={() => setIsOpen(!isOpen)} 
        className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-gray-700/80 transition-colors border-b border-gray-700/50"
      >
        <div className="flex items-center gap-4 min-w-0">
          {isSelectionMode && (
            <div onClick={e => e.stopPropagation()}>
                <input 
                    type="checkbox" 
                    checked={areAllWordsInSongSelected} 
                    onChange={handleGroupSelect} 
                    className="h-5 w-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-900 cursor-pointer" 
                />
            </div>
          )}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
            </div>
            <div className="truncate">
                <h3 className="font-bold text-lg text-white truncate">{song?.title || t('vocabularyPage.unknownSong')}</h3>
                <p className="text-sm text-gray-400 truncate">{song?.artist || t('vocabularyPage.unknownArtist')} • {words.length} words</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 ml-2">
            <span className={cn("text-gray-400 transform transition-transform duration-300", { 'rotate-180': isOpen })}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </span>
        </div>
      </header>
      {isOpen && (
        <div className="p-4 bg-gray-900/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             {words.map(word => <WordCard key={word.id} word={word} t={t} />)}
          </div>
        </div>
      )}
    </div>
  )
}

export default VocabularyPage;