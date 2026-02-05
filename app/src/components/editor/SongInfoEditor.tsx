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
      setActiveView('lyrics'); // Navigate to lyrics view on mobile after save
    }
  };

  const handleCancel = () => {
    setActivePanel('TOOL_PANEL');
    setActiveView('lyrics'); // Navigate to lyrics view on mobile after cancel
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col text-white">
      <h2 className="text-white text-xl font-bold mb-4">{t('songInfoEditor.title')}</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="song-title" className="block text-sm font-medium text-gray-300">{t('songInfoEditor.titleLabel')}</label>
          <input
            type="text"
            id="song-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
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
          />
        </div>
      </div>

      <div className="mt-auto pt-4 flex justify-end space-x-2">
        <button onClick={handleCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">{t('songInfoEditor.cancelButton')}</button>
        <button onClick={handleSave} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500">{t('songInfoEditor.saveButton')}</button>
      </div>
    </div>
  );
};

export default SongInfoEditor;