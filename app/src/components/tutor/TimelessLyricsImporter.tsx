// src/components/tutor/TimelessLyricsImporter.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useMobileViewStore from '@/stores/useMobileViewStore';
import useSongStore from '@/stores/useSongStore';
import useTranslation from '@/hooks/useTranslation';
import { db } from '@/lib/db';
import { LyricLine } from '@/interfaces/lyrics';
import { formatLyricTimings } from '@/utils/lyricsProcessor';
import cn from 'classnames';
import { copyToClipboard } from '@/utils/copyToClipboard';
import toast from 'react-hot-toast';

const Modal: React.FC<{ 
  title: string;
  content: string;
  onClose: () => void;
  t: (key: string) => string;
  children?: React.ReactNode;
}> = ({ title, content, onClose, t, children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl border border-gray-700" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4">{title}</h3>
        <textarea 
            className="w-full flex-grow bg-gray-900 border border-gray-700 rounded p-4 text-sm font-mono text-gray-300 resize-none outline-none custom-scrollbar" 
            readOnly 
            value={content} 
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
              onClick={() => {
                  copyToClipboard(content).then(() => {
                      toast.success(t('settings.tokenCopied') || 'Copied to clipboard');
                  }).catch(err => {
                      toast.error('Failed to copy content.');
                  });
              }}
              className="p-2 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors"
              title={t('settings.copyButton')}
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7 3a1 1 0 011-1h3a1 1 0 011 1v1h1a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h1V3z" />
                  <path d="M9 2a2 2 0 00-2 2v1h4V4a2 2 0 00-2-2z" />
              </svg>
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold transition-colors">
            {t('explore.preview.closeButton') || 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const LyricPreviewModal: React.FC<{
  newLyrics: LyricLine[];
  rawLLMOutput: string;
  onConfirm: () => void;
  onCancel: () => void;
  t: (key: string) => string
}> = ({ newLyrics, rawLLMOutput, onConfirm, onCancel, t }) => (
  <Modal 
    title={t('aiLyricCorrector.previewModalTitle')}
    content={`${t('aiLyricCorrector.parsedJsonPreview')}:\n\n${JSON.stringify(newLyrics, null, 2)}\n\n---\n\n${t('aiLyricCorrector.rawLlmOutput')}:\n\n${rawLLMOutput}`}
    onClose={onCancel}
    t={t}
  >
    <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">{t('sentenceEditor.cancelButton')}</button>
        <button onClick={onConfirm} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 font-bold">{t('sentenceEditor.saveButton')}</button>
    </div>
  </Modal>
);

const ErrorEditing: React.FC<{
  errorMessage: string;
  rawOutput: string;
  onRawOutputChange: (newOutput: string) => void;
  onRevalidate: () => void;
  t: (key: string) => string
}> = ({ errorMessage, rawOutput, onRawOutputChange, onRevalidate, t }) => (
  <div className="bg-red-800 border border-red-600 p-3 rounded-md mb-4">
    <h3 className="font-bold text-red-200">{t('aiLyricCorrector.errorOccurred')}</h3>
    <p className="text-red-200 text-sm whitespace-pre-wrap mb-2">{errorMessage}</p>
    <h4 className="font-semibold text-white mt-4 mb-1">{t('aiLyricCorrector.editRawLlmOutput')}</h4>
    <textarea
      className="w-full h-48 bg-gray-900 text-white p-2 rounded border border-gray-600 font-mono text-xs"
      value={rawOutput}
      onChange={(e) => onRawOutputChange(e.target.value)}
    />
    <button
      onClick={onRevalidate}
      className="mt-2 px-4 py-2 w-full bg-yellow-600 rounded-lg hover:bg-yellow-500 text-white font-bold"
    >
      {t('aiLyricCorrector.revalidateButton')}
    </button>
  </div>
);

// --- Utaten Search Modal ---
const UtatenSearchModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    defaultQuery: string;
    onSelect: (url: string) => void;
    t: (key: string) => string;
}> = ({ isOpen, onClose, defaultQuery, onSelect, t }) => {
    const [searchQuery, setSearchQuery] = useState(defaultQuery);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && defaultQuery) {
            setSearchQuery(defaultQuery);
            handleSearch(defaultQuery);
        }
    }, [isOpen, defaultQuery]);

    const handleSearch = async (query: string) => {
        if (!query.trim()) return;
        setIsSearching(true);
        setError(null);
        setSearchResults([]);
        try {
            const storedSettings = await db.settings.get(0);
            const backendUrl = storedSettings?.backendUrl || 'http://localhost:8000';
            const response = await fetch(`${backendUrl}/api/lyrics/search-utaten?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Search failed');
            }
            const data = await response.json();
            setSearchResults(data.results);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSearching(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
            <div className="bg-gray-800 text-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] flex flex-col mx-auto my-auto shadow-2xl border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-indigo-400">{t('aiLyricCorrector.utatenSearchTitle')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-xl">&times;</button>
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }} className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-grow p-2 rounded bg-gray-900 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder={t('explore.searchPlaceholder')}
                    />
                    <button type="submit" disabled={isSearching} className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500 font-bold disabled:opacity-50 transition-colors">
                        {isSearching ? t('index.searchingStatus') : t('index.searchButton')}
                    </button>
                </form>

                {error && <div className="text-red-400 text-sm mb-4">{error}</div>}

                <div className="flex-grow overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {searchResults.length === 0 && !isSearching && !error && (
                        <p className="text-center text-gray-500 py-4">{t('index.noResultsFound')}</p>
                    )}
                    {searchResults.map((result, idx) => (
                        <div 
                            key={idx}
                            onClick={() => onSelect(result.url)}
                            className="bg-gray-700/50 p-3 rounded cursor-pointer hover:bg-gray-700 border border-transparent hover:border-indigo-500 transition-colors"
                        >
                            <h3 className="font-bold text-gray-200">{result.title}</h3>
                            <p className="text-sm text-gray-400">{result.artist}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
};

const TimelessLyricsImporter: React.FC = () => {
  const { song, setProcessedLyrics } = useSongStore();
  const { t } = useTranslation();
  const { setActivePanel } = useUIPanelStore();
  const { setActiveView } = useMobileViewStore();

  const [plaintextLyrics, setPlaintextLyrics] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [mode, setMode] = useState<'generate' | 'import'>('generate');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [isPromptDirty, setIsPromptDirty] = useState(false);

  // Initialize prompt template from translation
  useEffect(() => {
    if (!isPromptDirty) {
      setPromptTemplate(t('timelessLyricsImporter.defaultPrompt'));
    }
  }, [t, isPromptDirty]);

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isFetchingUtaten, setIsFetchingUtaten] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ newLyrics: LyricLine[], rawLLMOutput: string } | null>(null);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [editableLlmOutput, setEditableLlmOutput] = useState<string>('');

  const handleFetchUtaten = async (url: string) => {
    setIsSearchModalOpen(false);
    setIsFetchingUtaten(true);
    setError(null);
    try {
        const storedSettings = await db.settings.get(0);
        const backendUrl = storedSettings?.backendUrl || 'http://localhost:8000';
        const response = await fetch(`${backendUrl}/api/lyrics/fetch-utaten?url=${encodeURIComponent(url)}`);
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Failed to fetch from Utaten');
        }
        const data = await response.json();
        setPlaintextLyrics(data.furigana_text);
    } catch (err) {
        setError(t('aiLyricCorrector.fetchError', { error: (err as Error).message }));
    } finally {
        setIsFetchingUtaten(false);
    }
  };

  const parseLlmOutput = (output: string) => {
    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = output.match(jsonRegex);
    if (!match || !match[1]) {
      throw new Error(t('aiLyricCorrector.jsonNotFoundInResponse'));
    }
    return JSON.parse(match[1]) as LyricLine[];
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setEditableLlmOutput('');
    setPreviewData(null);

    try {
      const storedSettings = await db.settings.get(0);
      const apiKey = storedSettings?.openaiApiKey;
      const apiUrl = storedSettings?.llmApiUrl || 'https://api.openai.com/v1/chat/completions';
      const modelType = storedSettings?.llmModelType || 'gpt-3.5-turbo';
      const maxTokens = storedSettings?.llmMaxTokens || 32768;

      if (!apiKey) throw new Error(t('aiLyricCorrector.apiKeyNotSet'));
      if (!plaintextLyrics.trim()) throw new Error("Please paste lyrics first.");

      const finalPrompt = promptTemplate.replace('{plaintext_lyrics}', plaintextLyrics);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelType, messages: [{ role: 'user', content: finalPrompt }], temperature: 0.3, max_tokens: maxTokens }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`${t('aiLyricCorrector.llmApiError')}: ${errorData.error?.message || t('aiLyricCorrector.failedToFetch')}`);
      }

      const result = await response.json();
      const llmOutput = result.choices[0]?.message?.content;

      if (!llmOutput) throw new Error(t('aiLyricCorrector.llmEmptyResponse'));

      try {
        const parsedJson = parseLlmOutput(llmOutput);
        setPreviewData({ newLyrics: parsedJson, rawLLMOutput: llmOutput });
      } catch (e) {
        setError((e as Error).message);
        setEditableLlmOutput(llmOutput);
      }

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevalidate = () => {
    try {
      const parsedJson = parseLlmOutput(editableLlmOutput);
      setPreviewData({ newLyrics: parsedJson, rawLLMOutput: editableLlmOutput });
      setError(null);
      setEditableLlmOutput('');
    } catch (e) {
      setError(t('aiLyricCorrector.revalidationFailed', { error: (e as Error).message }));
    }
  };

  const handlePreviewPrompt = () => {
    const finalPrompt = promptTemplate.replace('{plaintext_lyrics}', plaintextLyrics);
    setPromptPreview(finalPrompt);
  };
  
  const handleConfirm = () => {
    if (previewData) {
      setProcessedLyrics(formatLyricTimings(previewData.newLyrics));
    }
    setPreviewData(null);
    setActivePanel('TOOL_PANEL');
  };

  const handleDirectImport = () => {
    try {
        const parsedLyrics = JSON.parse(jsonInput);
        setProcessedLyrics(formatLyricTimings(parsedLyrics));
        setActivePanel('TOOL_PANEL');
    } catch (e) {
        toast.error(t('home.importError', { message: (e as Error).message }));
    }
  };

  return (
    <>
      <UtatenSearchModal 
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        defaultQuery={song?.title || ''}
        onSelect={handleFetchUtaten}
        t={t}
      />
      {previewData && (
        <LyricPreviewModal
          newLyrics={previewData.newLyrics}
          rawLLMOutput={previewData.rawLLMOutput}
          onConfirm={handleConfirm}
          onCancel={() => setPreviewData(null)}
          t={t}
        />
      )}
      {promptPreview && (
        <Modal 
          title={t('aiLyricCorrector.llmPromptPreviewTitle')}
          content={promptPreview}
          onClose={() => setPromptPreview(null)}
          t={t}
        />
      )}
      <div className="bg-gray-800 p-4 sm:p-5 rounded-2xl h-full flex flex-col text-white border border-gray-700/50 shadow-xl overflow-hidden">
        <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-700/50 flex-shrink-0">
          <h2 className="text-xl font-bold tracking-wide">{t('timelessLyricsImporter.title')}</h2>
          <button 
              onClick={() => setActivePanel('TOOL_PANEL')} 
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              {t('timelessLyricsImporter.backButton')}
          </button>
        </div>

        <div className="flex border-b border-gray-700 mb-4 flex-shrink-0">
          <button onClick={() => setMode('generate')} className={cn('px-4 py-2 text-sm font-medium', { 'border-b-2 border-indigo-500 text-white': mode === 'generate', 'text-gray-400': mode !== 'generate' })}>
              {t('timelessLyricsImporter.generateMode')}
          </button>
          <button onClick={() => setMode('import')} className={cn('px-4 py-2 text-sm font-medium', { 'border-b-2 border-indigo-500 text-white': mode === 'import', 'text-gray-400': mode !== 'import' })}>
              {t('timelessLyricsImporter.importMode')}
          </button>
        </div>
  
        {error && editableLlmOutput && (
            <ErrorEditing 
              errorMessage={error}
              rawOutput={editableLlmOutput}
              onRawOutputChange={setEditableLlmOutput}
              onRevalidate={handleRevalidate}
              t={t}
            />
        )}
        {error && !editableLlmOutput && (
           <div className="bg-red-800 border border-red-600 p-3 rounded-md mb-4 flex-shrink-0">
              <h3 className="font-bold text-red-200">{t('aiLyricCorrector.errorOccurred')}</h3>
              <p className="text-red-200 text-sm whitespace-pre-wrap">{error}</p>
            </div>
        )}

        {mode === 'generate' && (
          <div className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {/* Utaten Fetcher Section */}
            <div className="bg-gray-700/50 p-3 rounded-lg border border-gray-700 flex justify-between items-center">
              <div>
                  <h3 className="text-sm font-bold text-indigo-300">{t('aiLyricCorrector.utatenTitle')}</h3>
                  <p className="text-xs text-gray-400 mt-1">{t('aiLyricCorrector.utatenDescription')}</p>
              </div>
              <button
                  onClick={() => setIsSearchModalOpen(true)}
                  disabled={isFetchingUtaten}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-bold disabled:opacity-50 transition-colors whitespace-nowrap ml-2"
              >
                  {isFetchingUtaten ? t('aiLyricCorrector.fetchingButton') : t('aiLyricCorrector.searchUtatenButton')}
              </button>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-semibold mb-1 text-gray-300">{t('timelessLyricsImporter.step1PasteLyrics')}</label>
              <textarea 
                rows={10} 
                className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500" 
                placeholder={t('timelessLyricsImporter.placeholder')} 
                value={plaintextLyrics} 
                onChange={(e) => setPlaintextLyrics(e.target.value)} 
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold mb-1 text-gray-300">{t('timelessLyricsImporter.step2LlmPromptTemplate')}</label>
              <textarea 
                rows={8} 
                className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2" 
                value={promptTemplate} 
                onChange={(e) => { setPromptTemplate(e.target.value); setIsPromptDirty(true); }} 
                disabled={isLoading}
              />
              <div className="mb-4">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">{t('aiPanel.placeholdersTitle')}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {['{plaintext_lyrics}'].map(p => (
                    <code key={p} className="px-1.5 py-0.5 bg-indigo-900/30 text-indigo-300 border border-indigo-800/30 rounded text-[10px] font-mono">{p}</code>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 pb-4">
              <button
                className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                onClick={handlePreviewPrompt}
                disabled={isLoading}
              >
                {t('aiLyricCorrector.previewPromptButton')}
              </button>
              <button
                className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
                onClick={handleGenerate}
                disabled={isLoading}
              >
                {isLoading ? t('aiLyricCorrector.processingButton') : t('timelessLyricsImporter.generateButton')}
              </button>
            </div>
          </div>
        )}

        {mode === 'import' && (
          <div className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            <div className="flex flex-col">
              <label className="text-sm font-semibold mb-1 text-gray-300">{t('timelessLyricsImporter.importMode')}</label>
              <textarea 
                rows={20} 
                className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder={t('timelessLyricsImporter.jsonPlaceholder')} 
                value={jsonInput} 
                onChange={(e) => setJsonInput(e.target.value)} 
              />
            </div>
            <div className="flex justify-end mt-4 pb-4">
              <button onClick={handleDirectImport} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors active:scale-95" disabled={!jsonInput.trim()}>
                  {t('timelessLyricsImporter.importJsonButton')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TimelessLyricsImporter;
