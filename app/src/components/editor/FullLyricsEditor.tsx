// src/components/editor/FullLyricsEditor.tsx
import React, { useState, useEffect } from 'react';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useSongStore from '@/stores/useSongStore';
import { LyricLine } from '@/interfaces/lyrics';

const FullLyricsEditor: React.FC = () => {
  const { lyrics, setPreviewLyrics, clearPreviewLyrics, commitPreviewLyrics } = useSongStore();
  const { setActivePanel } = useUIPanelStore();
  
  const [jsonString, setJsonString] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    setJsonString(JSON.stringify(lyrics, null, 2));
    clearPreviewLyrics();
  }, [lyrics, clearPreviewLyrics]);

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newJsonString = e.target.value;
    setJsonString(newJsonString);
    try {
      const parsed = JSON.parse(newJsonString) as LyricLine[];
      setPreviewLyrics(parsed);
      setJsonError(null);
    } catch (error) {
      setJsonError((error as Error).message);
      clearPreviewLyrics();
    }
  };

  const handleSave = () => {
    if (jsonError) {
      alert(`Cannot save due to invalid JSON: ${jsonError}`);
      return;
    }
    commitPreviewLyrics();
    alert('Lyrics saved successfully!');
    setActivePanel('TOOL_PANEL');
  };

  const handleCancel = () => {
    clearPreviewLyrics();
    setActivePanel('TOOL_PANEL');
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col text-white">
      <h2 className="text-white text-xl font-bold mb-4">Edit Full Lyrics (JSON)</h2>
      
      <div className="flex-grow flex flex-col min-h-0">
        <textarea
          className="w-full h-full flex-grow bg-gray-900 text-white p-2 rounded border border-gray-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          value={jsonString}
          onChange={handleJsonChange}
        />
        {jsonError && (
          <div className="mt-2 p-2 bg-red-800 border border-red-600 rounded text-red-200 text-sm whitespace-pre-wrap">
            <strong>JSON Error:</strong> {jsonError}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end space-x-2">
        <button onClick={handleCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-white">
          Cancel
        </button>
        <button onClick={handleSave} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 text-white disabled:opacity-50" disabled={jsonError !== null}>
          Save
        </button>
      </div>
    </div>
  );
};

export default FullLyricsEditor;