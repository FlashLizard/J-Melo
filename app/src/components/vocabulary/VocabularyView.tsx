// src/components/vocabulary/VocabularyView.tsx
import React, { useEffect, useMemo, useState } from 'react';
import useVocabularyStore, { VocabDisplayMode } from '@/stores/useVocabularyStore';
import { WordRecord, SongRecord } from '@/lib/db';
import cn from 'classnames';
import CardViewer from '@/components/vocabulary/CardViewer';
import ReviewSetup from '@/components/vocabulary/ReviewSetup';
import Reviewer from '@/components/vocabulary/Reviewer';
import useTranslation from '@/hooks/useTranslation';

const VocabularyView = () => {
  const { 
    words, songs, displayMode, searchQuery, selectedIds, isSelectionMode,
    isReviewing,
    loadWordsAndSongs, setDisplayMode, setSearchQuery, toggleSelectionMode, 
    selectedIds: selectedIdsSet, toggleIdSelection, selectBySongId, selectAll, deselectAll, deleteSelected,
    exportSelectedToAnki
  } = useVocabularyStore();

  const [isReviewSetupOpen, setIsReviewSetupOpen] = useState(false);
  const { t } = useTranslation();

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
    const groups = new Map<number, WordRecord[]>();
    filteredWords.forEach(word => {
      const list = groups.get(word.sourceSongId) || [];
      list.push(word);
      groups.set(word.sourceSongId, list);
    });
    return Array.from(groups.entries()).map(([songId, words]) => ({
      song: songMap.get(songId),
      words
    })).sort((a, b) => (b.song?.id || 0) - (a.song?.id || 0));
  }, [filteredWords, displayMode, songMap]);

  if (isReviewing) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0f172a] h-screen text-white overflow-hidden">
        <Reviewer />
      </div>
    );
  }

  const handleExport = () => {
    exportSelectedToAnki(t);
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500 h-full">
      {isReviewSetupOpen && <ReviewSetup onClose={() => setIsReviewSetupOpen(false)} />}
      
      {/* Controls Bar */}
      <div className="bg-gray-800/60 backdrop-blur-md p-4 rounded-2xl mb-6 flex flex-col md:flex-row gap-4 items-center justify-between border border-gray-700/50 shadow-md flex-shrink-0">
        {/* View Modes */}
        <div className="flex bg-gray-900/80 p-1 rounded-xl w-full md:w-auto">
          <DisplayModeButton mode="all" current={displayMode} set={setDisplayMode} label={t('vocabularyPage.allMode')} />
          <DisplayModeButton mode="bySong" current={displayMode} set={setDisplayMode} label={t('vocabularyPage.bySongMode')} />
          <DisplayModeButton mode="search" current={displayMode} set={setDisplayMode} label={t('vocabularyPage.searchMode')} />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {isSelectionMode ? (
            <>
              <button onClick={selectAll} className="px-4 py-2 text-xs font-bold bg-gray-700 hover:bg-gray-600 rounded-xl transition-all border border-gray-600/50">{t('vocabularyPage.selectAllLabel')}</button>
              <button onClick={handleExport} disabled={selectedIds.size === 0} className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all disabled:opacity-50 border border-indigo-500/30 shadow-sm shadow-indigo-900/20">{t('vocabularyPage.exportButton')}</button>
              <button onClick={deleteSelected} disabled={selectedIds.size === 0} className="px-4 py-2 text-xs font-bold bg-red-900/40 text-red-300 hover:bg-red-600 hover:text-white rounded-xl transition-all disabled:opacity-50 border border-red-800/50">{t('vocabularyPage.deleteButton')}</button>
              <button onClick={toggleSelectionMode} className="px-4 py-2 text-xs font-bold bg-gray-700 hover:bg-gray-600 rounded-xl transition-all border border-gray-600/50">{t('vocabularyPage.cancelButton')}</button>
            </>
          ) : (
            <>
              <button onClick={() => setIsReviewSetupOpen(true)} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-md shadow-emerald-900/20 border border-emerald-500/30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                {t('vocabularyPage.reviewWordsButton')}
              </button>
              <button onClick={toggleSelectionMode} className="flex items-center gap-2 px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition-all border border-gray-600/50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {t('vocabularyPage.selectButton')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search Input (Conditional) */}
      {displayMode === 'search' && (
        <div className="mb-6 animate-in slide-in-from-top-2 duration-200">
          <input
            type="text"
            autoFocus
            placeholder={t('vocabularyPage.searchWordsPlaceholder')}
            className="w-full p-4 rounded-2xl bg-gray-800/40 border border-gray-700/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm shadow-inner"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Main Content List */}
      <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 pb-10">
        {filteredWords.length === 0 ? (
          <div className="text-center py-20 bg-gray-800/20 rounded-3xl border border-gray-700/30 border-dashed w-full">
            <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <p className="text-gray-500 font-medium">{t('reviewSetup.noWordsToReviewAlert')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayMode !== 'bySong' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWords.map(word => (
                  <WordCard key={word.id} word={word} song={songMap.get(word.sourceSongId)} t={t} />
                ))}
              </div>
            )}
            {displayMode === 'bySong' && wordsBySong?.map(({ song, words }) => (
              <SongGroup key={song?.id} song={song} words={words} t={t} />
            ))}
          </div>
        )}
      </div>
      <CardViewer />
    </div>
  );
};

const DisplayModeButton = ({ mode, current, set, label }: { mode: VocabDisplayMode, current: VocabDisplayMode, set: (mode: VocabDisplayMode) => void, label: string }) => (
  <button
    onClick={() => set(mode)}
    className={cn(
      "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap",
      current === mode ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
    )}
  >
    {label}
  </button>
);

const getProficiencyStyle = (p: number) => {
  if (p >= 80) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (p >= 50) return "text-blue-400 border-blue-500/30 bg-blue-500/10";
  if (p >= 20) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  return "text-rose-400 border-red-500/30 bg-red-500/10";
};

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

  return (
    <div 
        onClick={handleClick} 
        className={cn(
            "group bg-gray-800/60 backdrop-blur-sm p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 border relative overflow-hidden select-none", 
            isSelectionMode && selectedIds.has(word.id!) ? "border-indigo-500 ring-1 ring-indigo-500 bg-indigo-900/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]" : "border-gray-700/50 md:hover:bg-gray-700 md:hover:border-gray-600 cursor-pointer shadow-md md:hover:shadow-xl md:hover:-translate-y-1"
        )}
        style={{ WebkitTouchCallout: 'none' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      {isSelectionMode && (
          <div className="flex-shrink-0 z-10">
            <input type="checkbox" checked={selectedIds.has(word.id!)} onChange={() => {}} className="h-5 w-5 rounded border-gray-500 text-indigo-500 focus:ring-indigo-500 bg-gray-900/50 pointer-events-none" />
          </div>
      )}
      <div className="flex-grow min-w-0 z-10">
        <div className="flex items-baseline gap-3 mb-1.5">
            <p className="font-bold text-xl text-white truncate drop-shadow-sm">{word.surface}</p>
            <p className="text-sm text-gray-400 truncate">{word.reading}</p>
        </div>
        <div className="flex items-center justify-between mt-2">
            {song ? (
                <p className="text-xs text-gray-500 truncate flex items-center gap-1.5 max-w-[70%] bg-gray-900/50 px-2 py-1 rounded-lg border border-gray-700/30">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    {song.title}
                </p>
            ) : <div></div>}
            <span className={cn("text-[10px] px-2.5 py-1 rounded-full border font-bold font-mono tracking-wide shadow-sm", getProficiencyStyle(word.proficiency || 0))}>
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
    <div className="bg-gray-800/40 backdrop-blur-sm rounded-3xl border border-gray-700/50 overflow-hidden mb-6 shadow-lg">
      <header 
        onClick={() => setIsOpen(!isOpen)} 
        className="p-4 sm:p-5 flex items-center justify-between cursor-pointer md:hover:bg-gray-700/50 transition-colors border-b border-gray-700/30 group"
      >
        <div className="flex items-center gap-4 min-w-0">
          {isSelectionMode && (
            <div onClick={e => e.stopPropagation()}>
                <input 
                    type="checkbox" 
                    checked={areAllWordsInSongSelected} 
                    onChange={handleGroupSelect} 
                    className="h-5 w-5 rounded border-gray-500 text-indigo-500 focus:ring-indigo-500 bg-gray-900/50 cursor-pointer" 
                />
            </div>
          )}
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gray-900/50 flex items-center justify-center flex-shrink-0 shadow-inner border border-gray-700/50 md:group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6 text-indigo-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
            </div>
            <div className="truncate">
                <h3 className="font-bold text-lg text-white truncate drop-shadow-sm">{song?.title || t('vocabularyPage.unknownSong')}</h3>
                <p className="text-sm text-gray-400 truncate mt-0.5">{song?.artist || t('vocabularyPage.unknownArtist')} <span className="mx-2 text-gray-600">•</span> <span className="text-indigo-300 font-medium">{words.length} words</span></p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 ml-2">
            <span className={cn("text-gray-500 bg-gray-900/50 p-2 rounded-xl border border-gray-700/30 transform transition-transform duration-300 shadow-inner", { 'rotate-180': isOpen })}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
            </span>
        </div>
      </header>
      {isOpen && (
        <div className="p-4 sm:p-6 bg-[#0f172a]/30">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {words.map(word => <WordCard key={word.id} word={word} t={t} />)}
          </div>
        </div>
      )}
    </div>
  )
}

export default VocabularyView;
