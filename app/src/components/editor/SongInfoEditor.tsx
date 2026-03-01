// src/components/editor/SongInfoEditor.tsx
import React, { useState, useEffect } from 'react';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useSongStore from '@/stores/useSongStore';
import useMobileViewStore from '@/stores/useMobileViewStore'; // Import useMobileViewStore
import useTranslation from '@/hooks/useTranslation'; // Import useTranslation for consistency

const SongInfoEditor: React.FC = () => {
  const { song, updateSongInfo } = useSongStore();
  const { setActivePanel } = useUIPanelStore();
  const { setActiveView } = useMobileViewStore(); // Get setActiveView
  const { t } = useTranslation(); // Initialize useTranslation for consistency
  
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  useEffect(() => {
    if (song) {
      setTitle(song.title);
      setArtist(song.artist || '');
    }
  }, [song]);

  const handleSave = () => {
    if (song) {
      updateSongInfo({ title, artist });
      setActivePanel('TOOL_PANEL');
       // Navigate to lyrics view on mobile after save
    }
  };

  const handleCancel = () => {
    setActivePanel('TOOL_PANEL');
     // Navigate to lyrics view on mobile after cancel
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col text-white">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700/50">
        <h2 className="text-xl font-bold tracking-wide">{t('songInfoEditor.title')}</h2>
        <button 
          onClick={handleCancel} 
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          {t('vocabCardEditor.cancelButton') || 'Back'}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="song-title" className="block text-sm font-medium text-gray-300">{t('songInfoEditor.titleLabel')}</label>
          <input
            type="text"
            id="song-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder={t('songInfoEditor.titlePlaceholder')}
          />
        </div>
        <div>
          <label htmlFor="song-artist" className="block text-sm font-medium text-gray-300">{t('songInfoEditor.artistLabel')}</label>
          <input
            type="text"
            id="song-artist"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="mt-1 block w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder={t('songInfoEditor.artistPlaceholder')}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end space-x-2 border-t border-gray-700/50 pt-4">
        <button onClick={handleCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-white">{t('vocabCardEditor.cancelButton') || 'Cancel'}</button>
        <button onClick={handleSave} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 text-white">{t('fullLyricsEditor.saveButton') || 'Save'}</button>
      </div>
    </div>
  );
};

export default SongInfoEditor;
