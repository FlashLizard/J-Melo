// src/components/editor/SongInfoEditor.tsx
import React, { useState, useEffect } from 'react';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useSongStore from '@/stores/useSongStore';

const SongInfoEditor: React.FC = () => {
  const { song, updateSongInfo } = useSongStore();
  const { setActivePanel } = useUIPanelStore();
  
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
    }
  };

  const handleCancel = () => {
    setActivePanel('TOOL_PANEL');
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col text-white">
      <h2 className="text-white text-xl font-bold mb-4">Edit Song Info</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="song-title" className="block text-sm font-medium text-gray-300">Title</label>
          <input
            type="text"
            id="song-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label htmlFor="song-artist" className="block text-sm font-medium text-gray-300">Artist</label>
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
        <button onClick={handleCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">Cancel</button>
        <button onClick={handleSave} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500">Save</button>
      </div>
    </div>
  );
};

export default SongInfoEditor;
