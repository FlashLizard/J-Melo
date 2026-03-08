// src/components/tutor/LyricTranslationPanel.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useMobileViewStore from '@/stores/useMobileViewStore';
import useSongStore from '@/stores/useSongStore';
import { LyricLine } from '@/interfaces/lyrics';
import { formatLyricTimings } from '@/utils/lyricsProcessor';
import useTranslation from '@/hooks/useTranslation';
import { db } from '@/lib/db';
import { copyToClipboard } from '@/utils/copyToClipboard';
import cn from 'classnames';
import toast from 'react-hot-toast';

type TranslationMode = 'current' | 'mapProvided';
type MainMode = 'generate' | 'import';

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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 text-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-700">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <div className="flex-grow overflow-y-auto bg-gray-900 p-4 rounded-md border border-gray-700 mb-4">
          <pre className="text-sm whitespace-pre-wrap font-mono">{content}</pre>
        </div>

        {children}

        <div className="flex justify-end gap-2 mt-4">
          <button
              onClick={() => {
                  copyToClipboard(content).then(() => {
                      toast.success(t('settings.tokenCopied') || 'Copied!');
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
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors">{t('lyricTranslationPanel.closeButton')}</button>
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
    title={t('lyricTranslationPanel.previewModalTitle')}
    content={`${t('lyricTranslationPanel.parsedJsonPreview')}:\n\n${JSON.stringify(newLyrics, null, 2)}\n\n---\n\n${t('lyricTranslationPanel.rawLlmOutput')}:\n\n${rawLLMOutput}`}
    onClose={onCancel}
    t={t}
  >
    <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">{t('lyricTranslationPanel.cancelButton')}</button>
        <button onClick={onConfirm} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 font-bold">{t('lyricTranslationPanel.applyTranslationButton')}</button>
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
    <h3 className="font-bold text-red-200">{t('lyricTranslationPanel.errorOccurred')}</h3>
    <p className="text-red-200 text-sm whitespace-pre-wrap mb-2">{errorMessage}</p>
    <h4 className="font-semibold text-white mt-4 mb-1">{t('lyricTranslationPanel.editRawLlmOutput')}</h4>
    <textarea
      className="w-full h-48 bg-gray-900 text-white p-2 rounded border border-gray-700 font-mono text-xs"
      value={rawOutput}
      onChange={(e) => onRawOutputChange(e.target.value)}
    />
    <button
      onClick={onRevalidate}
      className="mt-2 px-4 py-2 w-full bg-yellow-600 rounded-lg hover:bg-yellow-500 text-white font-bold"
    >
      {t('lyricTranslationPanel.revalidateButton')}
    </button>
  </div>
);

// Helper function to create a simplified JSON for LLM prompts
const getSimplifiedLyricsJson = (lyrics: LyricLine[]) => {
  return lyrics.map(line => ({
    startTime: typeof line.startTime === 'number' ? Number(line.startTime.toFixed(2)) : line.startTime,
    endTime: typeof line.endTime === 'number' ? Number(line.endTime.toFixed(2)) : line.endTime,
    text: line.text,
    translation: line.translation, // Include existing translation if any
  }));
};

const LyricTranslationPanel: React.FC = () => {
  const { lyrics, song, updateLyricTranslations } = useSongStore();
  const { setActivePanel } = useUIPanelStore();
  const { setActiveView } = useMobileViewStore();
  const { t } = useTranslation();

  const [mainMode, setMainMode] = useState<MainMode>('generate');
  const [translationMode, setTranslationMode] = useState<TranslationMode>('current');
  const [providedLyrics, setProvidedLyrics] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [promptTemplate, setPromptTemplate] = useState(''); 
  const [isPromptDirty, setIsPromptDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ translatedLyrics: LyricLine[], rawLLMOutput: string } | null>(null);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [editableLlmOutput, setEditableLlmOutput] = useState<string>('');

  useEffect(() => {
    if (!isPromptDirty) {
      if (translationMode === 'mapProvided') {
        setPromptTemplate(t('lyricTranslationPanel.defaultProvidedPrompt'));
      } else {
        setPromptTemplate(t('lyricTranslationPanel.defaultCurrentPrompt'));
      }
    }
  }, [translationMode, t, isPromptDirty]);

  const parseLlmOutput = (output: string) => {
    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = output.match(jsonRegex);
    if (!match || !match[1]) {
      throw new Error(t('lyricTranslationPanel.jsonNotFoundInResponse'));
    }
    return JSON.parse(match[1]) as LyricLine[];
  };

  const handleTranslate = async () => {
    if (!lyrics || lyrics.length === 0) {
      toast.error(t('lyricTranslationPanel.noSongLoaded'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setEditableLlmOutput('');
    setPreviewData(null);

    try {
      const storedSettings = await db.settings.get(0);
      const apiKey = storedSettings?.translationLLMApiKey || storedSettings?.openaiApiKey;
      const apiUrl = storedSettings?.translationLLMApiUrl || storedSettings?.llmApiUrl || 'https://api.openai.com/v1/chat/completions';
      const modelType = storedSettings?.translationLLMModelType || storedSettings?.llmModelType || 'gpt-3.5-turbo';
      const maxTokens = storedSettings?.translationLLMMaxTokens || storedSettings?.llmMaxTokens || 32768;
      const targetLanguage = storedSettings?.aiResponseLanguage || 'English';

      if (!apiKey) throw new Error(t('lyricTranslationPanel.apiKeyNotSet'));
      if (translationMode === 'mapProvided' && !providedLyrics.trim()) {
        throw new Error(t('lyricTranslationPanel.pasteProvidedLyricsHint'));
      }

      const originalLyricsJson = JSON.stringify(getSimplifiedLyricsJson(lyrics), null, 2);
      
      let finalPrompt = promptTemplate
        .replace('{original_lyrics_json}', originalLyricsJson)
        .replace('{target_language}', targetLanguage);
      
      if (translationMode === 'mapProvided') {
        finalPrompt = finalPrompt.replace('{provided_lyrics}', providedLyrics);
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ 
            model: modelType, 
            messages: [{ role: 'user', content: finalPrompt }], 
            temperature: 0.3, 
            max_tokens: maxTokens 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`${t('lyricTranslationPanel.llmApiError')}: ${errorData.error?.message || t('lyricTranslationPanel.failedToFetch')}`);
      }

      const result = await response.json();
      const llmOutput = result.choices[0]?.message?.content;

      if (!llmOutput) throw new Error(t('lyricTranslationPanel.llmEmptyResponse'));

      try {
        const parsedJson = parseLlmOutput(llmOutput);
        setPreviewData({ translatedLyrics: parsedJson, rawLLMOutput: llmOutput });
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
      setPreviewData({ translatedLyrics: parsedJson, rawLLMOutput: editableLlmOutput });
      setError(null);
      setEditableLlmOutput('');
    } catch (e) {
      setError(t('lyricTranslationPanel.revalidationFailed', { error: (e as Error).message }));
    }
  };

  const handlePreviewPrompt = () => {
    const originalLyricsJson = JSON.stringify(getSimplifiedLyricsJson(lyrics), null, 2);
    const storedSettings = db.settings.get(0);
    storedSettings.then(settings => {
        const targetLanguage = settings?.aiResponseLanguage || 'English';
        let finalPrompt = promptTemplate
            .replace('{original_lyrics_json}', originalLyricsJson)
            .replace('{target_language}', targetLanguage);
        
        if (translationMode === 'mapProvided') {
            finalPrompt = finalPrompt.replace('{provided_lyrics}', providedLyrics);
        }
        setPromptPreview(finalPrompt);
    });
  };
  
  const handleConfirm = async () => {
    if (previewData) {
      const formattedForStore = previewData.translatedLyrics.map((line, idx) => ({
          index: idx,
          translation: line.translation || ''
      }));
      await updateLyricTranslations(formattedForStore);
      toast.success(t('lyricTranslationPanel.translationAppliedSuccess') || 'Translation applied!');
    }
    setPreviewData(null);
    setActivePanel('TOOL_PANEL');
  };

  const handleDirectImport = async () => {
    try {
        const parsedLyrics = JSON.parse(jsonInput);
        const formattedForStore = parsedLyrics.map((line: any, idx: number) => ({
            index: idx,
            translation: line.translation || ''
        }));
        await updateLyricTranslations(formattedForStore);
        toast.success(t('lyricTranslationPanel.translationAppliedSuccess') || 'Translation applied!');
        setActivePanel('TOOL_PANEL');
    } catch (e) {
        toast.error(t('home.importError', { message: (e as Error).message }));
    }
  };

  return (
    <>
      {previewData && (
        <LyricPreviewModal
          newLyrics={previewData.translatedLyrics}
          rawLLMOutput={previewData.rawLLMOutput}
          onConfirm={handleConfirm}
          onCancel={() => setPreviewData(null)}
          t={t}
        />
      )}
      {promptPreview && (
        <Modal 
          title={t('lyricTranslationPanel.llmPromptPreviewTitle')}
          content={promptPreview}
          onClose={() => setPromptPreview(null)}
          t={t}
        />
      )}
      <div className="bg-gray-800 p-4 sm:p-5 rounded-2xl h-full flex flex-col text-white border border-gray-700/50 shadow-xl overflow-hidden">
        <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-700/50 flex-shrink-0">
          <h2 className="text-xl font-bold tracking-wide">{t('lyricTranslationPanel.title')}</h2>
          <button 
              onClick={() => setActivePanel('TOOL_PANEL')} 
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              {t('lyricTranslationPanel.backButton')}
          </button>
        </div>

        <div className="flex border-b border-gray-700 mb-4 flex-shrink-0">
          <button onClick={() => setMainMode('generate')} className={cn('px-4 py-2 text-sm font-medium', { 'border-b-2 border-indigo-500 text-white': mainMode === 'generate', 'text-gray-400': mainMode !== 'generate' })}>
              {t('lyricTranslationPanel.generateMode')}
          </button>
          <button onClick={() => setMainMode('import')} className={cn('px-4 py-2 text-sm font-medium', { 'border-b-2 border-indigo-500 text-white': mainMode === 'import', 'text-gray-400': mainMode !== 'import' })}>
              {t('lyricTranslationPanel.importMode')}
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
              <h3 className="font-bold text-red-200">{t('lyricTranslationPanel.errorOccurred')}</h3>
              <p className="text-red-200 text-sm whitespace-pre-wrap">{error}</p>
            </div>
        )}

        {mainMode === 'generate' && (
            <div className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              <div className="flex flex-col">
                <label className="text-sm font-semibold mb-2 text-gray-300">
                  {t('lyricTranslationPanel.selectModeTitle')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => setTranslationMode('current')}
                        className={cn("p-2 text-xs rounded border transition-colors", translationMode === 'current' ? "bg-indigo-600 border-indigo-500 text-white" : "bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600")}
                    >
                        {t('lyricTranslationPanel.modeCurrentLyrics')}
                    </button>
                    <button 
                        onClick={() => setTranslationMode('mapProvided')}
                        className={cn("p-2 text-xs rounded border transition-colors", translationMode === 'mapProvided' ? "bg-indigo-600 border-indigo-500 text-white" : "bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600")}
                    >
                        {t('lyricTranslationPanel.modeMapProvidedTranslations')}
                    </button>
                </div>
              </div>

              {translationMode === 'mapProvided' && (
                <div className="flex flex-col">
                    <label htmlFor="provided-lyrics" className="text-sm font-semibold mb-1 text-gray-300">
                    {t('lyricTranslationPanel.step1PasteLyrics')}
                    </label>
                    <textarea
                    id="provided-lyrics"
                    rows={8}
                    className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder={t('lyricTranslationPanel.pasteLyricsPlaceholder')}
                    value={providedLyrics}
                    onChange={(e) => setProvidedLyrics(e.target.value)}
                    disabled={isLoading}
                    />
                </div>
              )}

              <div className="flex flex-col">
                <label htmlFor="prompt-template" className="text-sm font-semibold mb-1 text-gray-300">
                  {t('lyricTranslationPanel.step2LlmPromptTemplate')}
                </label>
                <textarea
                  id="prompt-template"
                  rows={8}
                  className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                  value={promptTemplate}
                  onChange={(e) => { setPromptTemplate(e.target.value); setIsPromptDirty(true); }}
                  disabled={isLoading}
                />
                <div className="mb-4">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">{t('aiPanel.placeholdersTitle')}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {['{provided_lyrics}', '{original_lyrics_json}', '{target_language}'].map(p => (
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
                  {t('lyricTranslationPanel.previewPromptButton')}
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors active:scale-95"
                  onClick={handleTranslate}
                  disabled={isLoading}
                >
                  {isLoading ? t('lyricTranslationPanel.processingButton') : t('lyricTranslationPanel.translateButton')}
                </button>
              </div>
            </div>
        )}

        {mainMode === 'import' && (
          <div className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            <div className="flex flex-col">
              <label className="text-sm font-semibold mb-1 text-gray-300">{t('lyricTranslationPanel.importMode')}</label>
              <textarea 
                rows={20} 
                className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder={t('lyricTranslationPanel.jsonPlaceholder')} 
                value={jsonInput} 
                onChange={(e) => setJsonInput(e.target.value)} 
              />
            </div>
            <div className="flex justify-end mt-4 pb-4">
              <button onClick={handleDirectImport} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-all active:scale-95" disabled={!jsonInput.trim()}>
                  {t('lyricTranslationPanel.importJsonButton')}
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default LyricTranslationPanel;
