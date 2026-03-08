import React, { useState, useEffect, useRef } from 'react';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useSongStore from '@/stores/useSongStore';
import useMobileViewStore from '@/stores/useMobileViewStore';
import useTranslation from '@/hooks/useTranslation';
import { LyricLine } from '@/interfaces/lyrics';
import { formatLyricTimings } from '@/utils/lyricsProcessor';
import { copyToClipboard } from '@/utils/copyToClipboard';
import toast from 'react-hot-toast';

const FullLyricsEditor: React.FC = () => {
  const { lyrics, setPreviewLyrics, clearPreviewLyrics, commitPreviewLyrics } = useSongStore();
  const { setActivePanel } = useUIPanelStore();
  const { setActiveView } = useMobileViewStore();
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [jsonString, setJsonString] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    // Format on load to keep it clean
    setJsonString(JSON.stringify(formatLyricTimings(lyrics), null, 2));
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
      toast.error(t('fullLyricsEditor.jsonSaveError', { error: jsonError }));
      return;
    }
    
    // Auto-format before saving
    try {
        const parsed = JSON.parse(jsonString) as LyricLine[];
        const formatted = formatLyricTimings(parsed);
        setPreviewLyrics(formatted);
        commitPreviewLyrics();
        toast.success(t('fullLyricsEditor.lyricsSavedSuccess'));
        setActivePanel('TOOL_PANEL');
    } catch (e) {
        toast.error('Invalid JSON. Please fix before saving.');
    }
  };

  const handleCancel = () => {
    clearPreviewLyrics();
    
    setActivePanel('TOOL_PANEL');
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col text-white border border-gray-700/50 shadow-xl overflow-hidden">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700/50 flex-shrink-0">
        <h2 className="text-xl font-bold tracking-wide">{t('fullLyricsEditor.title')}</h2>
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          {t('vocabCardEditor.cancelButton') || 'Back'}
        </button>
      </div>

      <div className="flex gap-2 mb-4 justify-end flex-shrink-0">
          <button
            onClick={handleSelectAll}
            className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-gray-300 transition"
          >
            {t('fullLyricsEditor.selectAllButton') || 'Select All'}
          </button>
          <button
            onClick={handleCopy}
            className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-gray-300 transition flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 3a1 1 0 011-1h3a1 1 0 011 1v1h1a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h1V3z" />
              <path d="M9 2a2 2 0 00-2 2v1h4V4a2 2 0 00-2-2z" />
            </svg>
            {t('common.copy') || 'Copy'}
          </button>
      </div>

      <div className="flex-grow flex flex-col min-h-0">
        <textarea
          ref={textareaRef}
          className="w-full h-full flex-grow bg-gray-900 border border-gray-700 rounded-md p-3 text-sm font-mono text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none custom-scrollbar"
          value={jsonString}
          onChange={handleJsonChange}
          spellCheck={false}
        />
      </div>

      {jsonError && (
        <div className="mt-2 text-red-500 text-sm">
          {t('fullLyricsEditor.jsonErrorHeader')}: {jsonError}
        </div>
      )}

      <div className="mt-4 flex justify-end space-x-2 pt-4 border-t border-gray-700/50 flex-shrink-0">
        <button onClick={handleCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-white">{t('vocabCardEditor.cancelButton') || 'Cancel'}</button>
        <button onClick={handleSave} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 text-white disabled:opacity-50" disabled={jsonError !== null}>
          {t('fullLyricsEditor.saveButton')}
        </button>
      </div>
    </div>
  );
};

export default FullLyricsEditor;
