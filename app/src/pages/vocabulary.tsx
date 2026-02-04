// src/pages/vocabulary.tsx
import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import useVocabularyStore, { VocabDisplayMode } from '@/stores/useVocabularyStore';
import { WordRecord, SongRecord } from '@/lib/db';
import cn from 'classnames';
import CardViewer from '@/components/vocabulary/CardViewer';
import ReviewSetup from '@/components/vocabulary/ReviewSetup';
import Reviewer from '@/components/vocabulary/Reviewer';

const VocabularyPage = () => {
  const { 
    words, songs, displayMode, searchQuery, selectedIds, isSelectionMode,
    isReviewing,
    loadWordsAndSongs, setDisplayMode, setSearchQuery, toggleSelectionMode, 
    toggleIdSelection, selectBySongId, selectAll, deselectAll, deleteSelected 
  } = useVocabularyStore();

  const [isReviewSetupOpen, setIsReviewSetupOpen] = useState(false);

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
      return words.filter(word => word.surface.toLowerCase().includes(searchQuery.toLowerCase()));
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
        <title>Vocabulary - J-Melo</title>
      </Head>
      {isReviewSetupOpen && <ReviewSetup onClose={() => setIsReviewSetupOpen(false)} />}
      <main className="bg-gray-900 min-h-screen text-white p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Vocabulary</h1>
            <Link href="/" className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500">Back to Player</Link>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg mb-6 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <DisplayModeButton mode="all" current={displayMode} set={setDisplayMode} />
              <DisplayModeButton mode="bySong" current={displayMode} set={setDisplayMode} />
              <DisplayModeButton mode="search" current={displayMode} set={setDisplayMode} />
            </div>
            {displayMode === 'search' && (
              <input 
                type="text"
                placeholder="Search words..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            )}
            <div className="flex items-center gap-4">
              {isSelectionMode ? (
                <>
                  <button onClick={deleteSelected} className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500 text-sm disabled:opacity-50" disabled={selectedIds.size === 0}>Delete ({selectedIds.size})</button>
                  <button className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 text-sm disabled:opacity-50" disabled={selectedIds.size === 0}>Export ({selectedIds.size})</button>
                  <button onClick={toggleSelectionMode} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-sm">Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsReviewSetupOpen(true)} className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-500 text-sm">Review Words</button>
                  <button onClick={toggleSelectionMode} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-sm">Select</button>
                </>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            {isSelectionMode && displayMode !== 'bySong' && (
              <div className="flex items-center p-2">
                <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-green-500 focus:ring-green-500" />
                <label className="ml-3 text-sm">Select All</label>
              </div>
            )}
            
            {displayMode === 'all' || displayMode === 'search' ? (
              filteredWords.map(word => <WordCard key={word.id} word={word} song={songMap.get(word.sourceSongId)} />)
            ) : null}

            {displayMode === 'bySong' && wordsBySong?.map(({ song, words }) => (
              <SongGroup key={song?.id} song={song} words={words} />
            ))}
          </div>
        </div>
        <CardViewer />
      </main>
    </>
  );
};

const DisplayModeButton = ({ mode, current, set }: { mode: VocabDisplayMode, current: VocabDisplayMode, set: (mode: VocabDisplayMode) => void }) => (
  <button onClick={() => set(mode)} className={cn("px-3 py-1 rounded-md text-sm capitalize", { 'bg-green-600 text-white': current === mode, 'bg-gray-700': current !== mode })}>
    {mode === 'bySong' ? 'By Song' : mode}
  </button>
);

const WordCard = ({ word, song }: { word: WordRecord, song?: SongRecord }) => {
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
    <div onClick={handleClick} className={cn("bg-gray-800 p-4 rounded-lg flex items-center gap-4 transition-colors", { 'hover:bg-gray-700 cursor-pointer': !isSelectionMode, 'ring-2 ring-green-500': isSelectionMode && selectedIds.has(word.id!) })}>
      {isSelectionMode && <input type="checkbox" checked={selectedIds.has(word.id!)} onChange={() => {}} className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-green-500 focus:ring-green-500" />}
      <div className="flex-grow">
        <p className="font-bold text-lg">{word.surface}</p>
        <p className="text-sm text-gray-400">{word.reading}</p>
      </div>
      {song && <p className="text-xs text-gray-500 text-right">{song.title}</p>}
    </div>
  );
};

const SongGroup = ({ song, words }: { song?: SongRecord, words: WordRecord[] }) => {
  const [isOpen, setIsOpen] = useState(true);
  const { isSelectionMode, selectedIds, selectBySongId } = useVocabularyStore();
  
  const wordsInThisSongIds = useMemo(() => words.map(w => w.id!), [words]);
  const areAllWordsInSongSelected = useMemo(() => wordsInThisSongIds.every(id => selectedIds.has(id)), [wordsInThisSongIds, selectedIds]);

  const handleGroupSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectBySongId(song!.id!, e.target.checked);
  };
  
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <header onClick={() => setIsOpen(!isOpen)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-700">
        <div className="flex items-center gap-4">
          {isSelectionMode && <input type="checkbox" checked={areAllWordsInSongSelected} onChange={handleGroupSelect} onClick={e => e.stopPropagation()} className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-green-500 focus:ring-green-500" />}
          <div>
            <h3 className="font-bold text-xl">{song?.title || 'Unknown Song'}</h3>
            <p className="text-sm text-gray-400">{song?.artist}</p>
          </div>
        </div>
        <span className={cn("transform transition-transform", { 'rotate-180': isOpen })}>{'▼'}</span>
      </header>
      {isOpen && (
        <div className="p-4 border-t border-gray-700 space-y-2">
          {words.map(word => <WordCard key={word.id} word={word} />)}
        </div>
      )}
    </div>
  )
}

export default VocabularyPage;