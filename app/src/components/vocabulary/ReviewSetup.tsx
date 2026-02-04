// src/components/vocabulary/ReviewSetup.tsx
import React, { useState, useMemo } from 'react';
import useVocabularyStore from '@/stores/useVocabularyStore';
import { SongRecord } from '@/lib/db';
import useTranslation from '@/hooks/useTranslation'; // Import useTranslation

interface ReviewSetupProps {
  onClose: () => void;
}

const ReviewSetup: React.FC<ReviewSetupProps> = ({ onClose }) => {
  const { songs, words, startReview } = useVocabularyStore();
  const [mode, setMode] = useState<'all' | 'bySong'>('all');
  const [selectedSongIds, setSelectedSongIds] = useState<Set<number>>(new Set());
  const { t } = useTranslation(); // Initialize useTranslation

  const songsWithWords = useMemo(() => {
    const songIdWithWords = new Set(words.map(w => w.sourceSongId));
    return songs.filter(song => songIdWithWords.has(song.id!));
  }, [songs, words]);

  const handleToggleSong = (songId: number) => {
    setSelectedSongIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(songId)) {
        newSet.delete(songId);
      } else {
        newSet.add(songId);
      }
      return newSet;
    });
  };

  const handleStartReview = () => {
    let wordsToReview = words;
    if (mode === 'bySong') {
      if (selectedSongIds.size === 0) {
        alert(t('reviewSetup.selectAtLeastOneSongAlert'));
        return;
      }
      wordsToReview = words.filter(word => selectedSongIds.has(word.sourceSongId));
    }
    
    if (wordsToReview.length === 0) {
      alert(t('reviewSetup.noWordsToReviewAlert'));
      return;
    }
    startReview(wordsToReview);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 text-white rounded-lg p-6 max-w-lg w-full flex flex-col">
        <h2 className="text-2xl font-bold mb-4">{t('reviewSetup.title')}</h2>

        <div className="flex gap-4 mb-4">
          <button onClick={() => setMode('all')} className={`flex-1 p-2 rounded ${mode === 'all' ? 'bg-green-600' : 'bg-gray-700'}`}>{t('reviewSetup.reviewAllButton')}</button>
          <button onClick={() => setMode('bySong')} className={`flex-1 p-2 rounded ${mode === 'bySong' ? 'bg-green-600' : 'bg-gray-700'}`}>{t('reviewSetup.reviewBySongButton')}</button>
        </div>

        {mode === 'bySong' && (
          <div className="bg-gray-900 p-3 rounded-lg max-h-60 overflow-y-auto mb-4">
            <h3 className="font-semibold mb-2">{t('reviewSetup.selectSongsHint')}</h3>
            <div className="space-y-2">
              {songsWithWords.length > 0 ? (
                songsWithWords.map(song => (
                  <label key={song.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={selectedSongIds.has(song.id!)}
                      onChange={() => handleToggleSong(song.id!)}
                      className="h-5 w-5 rounded bg-gray-600 border-gray-500 text-green-500 focus:ring-green-500 flex-shrink-0"
                    />
                    <span>{song.title}</span>
                  </label>
                ))
              ) : (
                <p className="text-gray-400">{t('reviewSetup.noSongsWithWords')}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-4 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">{t('reviewSetup.cancelButton')}</button>
          <button onClick={handleStartReview} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500">{t('reviewSetup.startReviewButton')}</button>
        </div>
      </div>
    </div>
  );
};

export default ReviewSetup;