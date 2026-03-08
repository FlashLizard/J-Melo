import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useSongStore from '@/stores/useSongStore';
import useTranslation from '@/hooks/useTranslation';
import { SongRecord, WordRecord } from '@/lib/db';
import toast from 'react-hot-toast';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleResolutionChange = (songId: number, resolution: Resolution) => {
    setResolutions(prev => ({ ...prev, [songId]: resolution }));
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      if (nonConflictingSongs.length > 0) {
        const wordsForNewSongs = importedWords.filter(word => 
          nonConflictingSongs.some(s => s.id === word.sourceSongId)
        );
        await addManySongs(nonConflictingSongs, wordsForNewSongs);
      }

      for (const conflict of conflicts) {
        const existingId = conflict.existingSong.id!;
        const resolution = resolutions[existingId] || 'skip';
        const wordsForThisSong = importedWords.filter(w => w.sourceSongId === conflict.importedSong.id);

        if (resolution === 'overwrite') {
          await overwriteSong(existingId, conflict.importedSong, wordsForThisSong);
        } else if (resolution === 'merge') {
          await mergeWordsIntoSong(existingId, wordsForThisSong);
        }
      }
      
      onImportComplete();
    } catch (error) {
      toast.error(t('home.importError', { message: (error as Error).message }));
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[200] p-4">
      <div className="bg-gray-800 text-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-700">
        <h2 className="text-2xl font-bold mb-4">{t('importConflict.title')}</h2>
        <p className="text-gray-300 mb-4">{t('importConflict.description', { count: conflicts.length })}</p>
        
        <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {conflicts.map(conflict => {
            const songId = conflict.existingSong.id!;
            return (
              <div key={songId} className="bg-gray-700/50 p-3 rounded-xl border border-gray-600/50 flex justify-between items-center">
                <div className="truncate pr-4">
                  <p className="font-bold truncate text-white">{conflict.existingSong.title}</p>
                  <p className="text-sm text-gray-400 truncate">{conflict.existingSong.artist}</p>
                </div>
                <select 
                  value={resolutions[songId] || 'skip'}
                  onChange={(e) => handleResolutionChange(songId, e.target.value as Resolution)}
                  className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 text-white outline-none"
                >
                  <option value="skip">{t('importConflict.optionSkip')}</option>
                  <option value="overwrite">{t('importConflict.optionOverwrite')}</option>
                  <option value="merge">{t('importConflict.optionMerge')}</option>
                </select>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-700/50">
          <button onClick={onClose} disabled={isProcessing} className="px-6 py-2.5 bg-gray-700 rounded-xl hover:bg-gray-600 transition-colors font-medium">{t('importConflict.cancelButton')}</button>
          <button onClick={handleConfirm} disabled={isProcessing} className="px-8 py-2.5 bg-green-600 rounded-xl hover:bg-green-500 font-bold shadow-lg shadow-green-900/20 active:scale-95 transition-all">
            {isProcessing ? t('importConflict.processingButton') : t('importConflict.confirmButton')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ImportConflictModal;
