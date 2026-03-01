import React, { useState } from 'react';
import useSongStore from '@/stores/useSongStore';
import useTranslation from '@/hooks/useTranslation';
import { SongRecord, WordRecord } from '@/lib/db';

export interface Conflict {
  existingSong: SongRecord;
  importedSong: SongRecord;
}

interface ImportConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: Conflict[];
  nonConflictingSongs: SongRecord[];
  importedWords: WordRecord[];
  onImportComplete: () => void;
}

type Resolution = 'skip' | 'overwrite' | 'merge';

const ImportConflictModal: React.FC<ImportConflictModalProps> = ({ 
  isOpen, 
  onClose, 
  conflicts, 
  nonConflictingSongs, 
  importedWords, 
  onImportComplete 
}) => {
  const { t } = useTranslation();
  const { overwriteSong, mergeWordsIntoSong, addManySongs } = useSongStore();
  const [resolutions, setResolutions] = useState<Record<number, Resolution>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const handleResolutionChange = (songId: number, resolution: Resolution) => {
    setResolutions(prev => ({ ...prev, [songId]: resolution }));
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      // Handle non-conflicting songs first
      if (nonConflictingSongs.length > 0) {
        const wordsForNewSongs = importedWords.filter(word => 
          nonConflictingSongs.some(s => s.id === word.sourceSongId)
        );
        await addManySongs(nonConflictingSongs, wordsForNewSongs);
      }

      // Handle conflicting songs based on user resolutions
      for (const conflict of conflicts) {
        const existingId = conflict.existingSong.id!;
        const resolution = resolutions[existingId] || 'skip'; // Default to skip
        const wordsForThisSong = importedWords.filter(w => w.sourceSongId === conflict.importedSong.id);

        if (resolution === 'overwrite') {
          await overwriteSong(existingId, conflict.importedSong, wordsForThisSong);
        } else if (resolution === 'merge') {
          await mergeWordsIntoSong(existingId, wordsForThisSong);
        }
        // If 'skip', do nothing
      }
      
      onImportComplete();
    } catch (error) {
      alert(t('home.importError', { message: (error as Error).message }));
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 text-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold mb-4">{t('importConflict.title')}</h2>
        <p className="text-gray-300 mb-4">{t('importConflict.description', { count: conflicts.length })}</p>
        
        <div className="flex-grow overflow-y-auto space-y-4 pr-2">
          {conflicts.map(conflict => {
            const songId = conflict.existingSong.id!;
            return (
              <div key={songId} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                <div className="truncate">
                  <p className="font-semibold">{conflict.existingSong.title}</p>
                  <p className="text-sm text-gray-400">{conflict.existingSong.artist}</p>
                </div>
                <select 
                  value={resolutions[songId] || 'skip'}
                  onChange={(e) => handleResolutionChange(songId, e.target.value as Resolution)}
                  className="bg-gray-900 border border-gray-600 rounded-md p-2 text-sm focus:ring-green-500 focus:border-green-500"
                >
                  <option value="skip">{t('importConflict.optionSkip')}</option>
                  <option value="overwrite">{t('importConflict.optionOverwrite')}</option>
                  <option value="merge">{t('importConflict.optionMerge')}</option>
                </select>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end space-x-2">
          <button onClick={onClose} disabled={isProcessing} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">{t('importConflict.cancelButton')}</button>
          <button onClick={handleConfirm} disabled={isProcessing} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500">
            {isProcessing ? t('importConflict.processingButton') : t('importConflict.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportConflictModal;
