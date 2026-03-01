// src/components/editor/FullLyricsEditor.tsx
import React, { useState, useEffect, useRef } from 'react';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useSongStore from '@/stores/useSongStore';
import useMobileViewStore from '@/stores/useMobileViewStore'; // Import useMobileViewStore
import useTranslation from '@/hooks/useTranslation'; // Import useTranslation
import { LyricLine } from '@/interfaces/lyrics';
import { copyToClipboard } from '@/utils/copyToClipboard';
import toast from 'react-hot-toast';

const FullLyricsEditor: React.FC = () => {
  const { lyrics, setPreviewLyrics, clearPreviewLyrics, commitPreviewLyrics } = useSongStore();
  const { setActivePanel } = useUIPanelStore();
  const { setActiveView } = useMobileViewStore(); // Get setActiveView
  const { t } = useTranslation(); // Initialize useTranslation
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSelectAll = () => {
    if (textareaRef.current) {
      textareaRef.current.select();
    }
  };

  const handleCopy = () => {
    copyToClipboard(jsonString)
      .then(() => toast.success(t('settings.tokenCopied') || 'Copied!'))
      .catch(err => toast.error('Failed to copy JSON.'));
  };
  const handleSave = () => {
    if (jsonError) {
      alert(t('fullLyricsEditor.jsonSaveError', { error: jsonError }));
      return;
    }
    commitPreviewLyrics();
    
    setActivePanel('TOOL_PANEL');
    setActiveView('lyrics'); // Navigate to lyrics view on mobile after save
  };

  const handleCancel = () => {
    clearPreviewLyrics();
    setActivePanel('TOOL_PANEL');
    setActiveView('lyrics'); // Navigate to lyrics view on mobile after cancel
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col text-white">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white text-xl font-bold">{t('fullLyricsEditor.title')}</h2>
        <div className="flex gap-2">
          <button 
            onClick={handleSelectAll}
            className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 transition"
          >
            {t('fullLyricsEditor.selectAllButton') || 'Select All'}
          </button>
          <button 
            onClick={handleCopy}
            className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 transition flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 3a1 1 0 011-1h3a1 1 0 011 1v1h1a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h1V3z" />
              <path d="M9 2a2 2 0 00-2 2v1h4V4a2 2 0 00-2-2z" />
            </svg>
            {t('common.copy') || 'Copy'}
          </button>
        </div>
      </div>
      
      <div className="flex-grow flex flex-col min-h-0">
        <textarea
          ref={textareaRef}
          className="w-full h-full flex-grow bg-gray-900 text-white p-2 rounded border border-gray-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          value={jsonString}
          onChange={handleJsonChange}
        />
        {jsonError && (
          <div className="mt-2 p-2 bg-red-800 border border-red-600 rounded text-red-200 text-sm whitespace-pre-wrap">
            <strong>{t('fullLyricsEditor.jsonErrorHeader')}:</strong> {jsonError}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end space-x-2">
        <button onClick={handleCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-white">
          {t('fullLyricsEditor.cancelButton')}
        </button>
        <button onClick={handleSave} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 text-white disabled:opacity-50" disabled={jsonError !== null}>
          {t('fullLyricsEditor.saveButton')}
        </button>
      </div>
    </div>
  );
};

export default FullLyricsEditor;
