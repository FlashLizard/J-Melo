import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useMobileViewStore from '@/stores/useMobileViewStore';
import useSongStore from '@/stores/useSongStore';
import useTranslation from '@/hooks/useTranslation';
import { db } from '@/lib/db';
import { LyricLine } from '@/interfaces/lyrics';
import cn from 'classnames';
import { copyToClipboard } from '@/utils/copyToClipboard';

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
      <div className="bg-gray-800 text-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <div className="flex-grow overflow-y-auto bg-gray-900 p-4 rounded-md border border-gray-700 mb-4">
          <pre className="text-sm whitespace-pre-wrap">{content}</pre>
        </div>
        
        {children}

        <div className="flex justify-end gap-2 mt-4">
          <button 
              onClick={() => {
                  copyToClipboard(content).then(() => {
                      alert(t('settings.tokenCopied'));
                  }).catch(err => {
                      console.error('Failed to copy content: ', err);
                      alert('Failed to copy content.');
                  });
              }}
              className="p-2 bg-gray-600 rounded-lg hover:bg-gray-500"
              title={t('settings.copyButton')}
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7 3a1 1 0 011-1h3a1 1 0 011 1v1h1a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h1V3z" />
                  <path d="M9 2a2 2 0 00-2 2v1h4V4a2 2 0 00-2-2z" />
              </svg>
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">{t('aiLyricCorrector.closeButton')}</button>
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
    <div className="flex justify-end gap-2">
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

const TIMELESS_LYRICS_PROMPT = `You are an expert in Japanese lyrics. A user has provided a block of text containing song lyrics.

Your task is to convert this plain text into a structured JSON format. The JSON should be an array of "lyric lines".

Each line object must contain:
- "id": A unique string for the line.
- "startTime": Set this to 0.
- "endTime": Set this to 0.
- "text": The full Japanese text of the sentence.
- "translation": An empty string.
- "tokens": An array of word objects.

Each word object in the "tokens" array must contain:
- "surface": The Japanese word.
- "reading": The hiragana reading of the word (furigana).
- "startTime": Set this to 0.
- "endTime": Set this to 0.

Here are the lyrics provided by the user:
---
{raw_lyrics}
---

Please output ONLY the JSON object enclosed in a single markdown code block. Do not include any other text or explanation.`;

const TimelessLyricsImporter: React.FC = () => {
  const { setProcessedLyrics } = useSongStore();
  const { t } = useTranslation();
  const { setActivePanel } = useUIPanelStore();
  const { setActiveView } = useMobileViewStore();

  const [mode, setMode] = useState<'generate' | 'import'>('generate');
  const [rawLyrics, setRawLyrics] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [promptTemplate, setPromptTemplate] = useState(TIMELESS_LYRICS_PROMPT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [editableLlmOutput, setEditableLlmOutput] = useState('');
  const [previewData, setPreviewData] = useState<{ newLyrics: LyricLine[], rawLLMOutput: string } | null>(null);

  const parseLlmOutput = (output: string): LyricLine[] => {
    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = output.match(jsonRegex);
    if (!match || !match[1]) {
      throw new Error(t('aiLyricCorrector.jsonNotFoundInResponse'));
    }
    return JSON.parse(match[1]);
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setEditableLlmOutput('');
    setPreviewData(null);
    try {
        const settings = await db.settings.get(0);
        const apiKey = settings?.lyricFixLLMApiKey || settings?.openaiApiKey;
        const apiUrl = settings?.lyricFixLLMApiUrl || settings?.llmApiUrl || 'https://api.openai.com/v1/chat/completions';
        const modelType = settings?.lyricFixLLMModelType || settings?.llmModelType || 'gpt-3.5-turbo';
        const maxTokens = settings?.lyricFixLLMMaxTokens || settings?.llmMaxTokens || 32768;

        if (!apiKey) throw new Error(t('aiLyricCorrector.apiKeyNotSet'));
        if (!rawLyrics.trim()) throw new Error(t('timelessLyricsImporter.pasteLyrics'));

        const finalPrompt = promptTemplate.replace('{raw_lyrics}', rawLyrics);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: modelType, messages: [{ role: 'user', content: finalPrompt }], temperature: 0.2, max_tokens: maxTokens }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`${t('aiLyricCorrector.llmApiError')}: ${errorData.error?.message || t('aiLyricCorrector.failedToFetch')}`);
        }

        const result = await response.json();
        const llmOutput = result.choices[0]?.message?.content;
        if (!llmOutput) throw new Error(t('aiLyricCorrector.llmEmptyResponse'));

        try {
            const parsedLyrics = parseLlmOutput(llmOutput);
            setPreviewData({ newLyrics: parsedLyrics, rawLLMOutput: llmOutput });
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
        const parsedLyrics = parseLlmOutput(editableLlmOutput);
        setPreviewData({ newLyrics: parsedLyrics, rawLLMOutput: editableLlmOutput });
        setError(null);
        setEditableLlmOutput('');
    } catch (e) {
        setError(t('aiLyricCorrector.revalidationFailed', { error: (e as Error).message }));
    }
  };

  const handleDirectImport = () => {
    try {
        const parsedLyrics = JSON.parse(jsonInput);
        setProcessedLyrics(parsedLyrics);
        alert(t('aiLyricCorrector.lyricsUpdatedSuccess'));
        setActivePanel('TOOL_PANEL');
        setActiveView('lyrics');
    } catch (e) {
        alert(t('home.importError', { message: (e as Error).message }));
    }
  };

  const handleConfirm = () => {
    if (previewData) {
      setProcessedLyrics(previewData.newLyrics);
      alert(t('aiLyricCorrector.lyricsUpdatedSuccess'));
    }
    setPreviewData(null);
    setActivePanel('TOOL_PANEL');
    setActiveView('lyrics');
  };

  return (
    <>
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
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col text-white">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{t('lyricsDisplay.noLyrics.importButton')}</h2>
        <button onClick={() => { setActivePanel('TOOL_PANEL'); setActiveView('lyrics'); }} className="px-3 py-1 bg-gray-600 rounded-lg hover:bg-gray-500 text-sm">
            {t('aiLyricCorrector.backButton')}
        </button>
      </div>

      <div className="flex border-b border-gray-700 mb-4">
        <button onClick={() => setMode('generate')} className={cn('px-4 py-2 text-sm font-medium', { 'border-b-2 border-green-500 text-white': mode === 'generate', 'text-gray-400': mode !== 'generate' })}>
            {t('timelessLyricsImporter.generateMode')}
        </button>
        <button onClick={() => setMode('import')} className={cn('px-4 py-2 text-sm font-medium', { 'border-b-2 border-green-500 text-white': mode === 'import', 'text-gray-400': mode !== 'import' })}>
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
         <div className="bg-red-800 border border-red-600 p-3 rounded-md mb-4">
            <h3 className="font-bold text-red-200">{t('aiLyricCorrector.errorOccurred')}</h3>
            <p className="text-red-200 text-sm whitespace-pre-wrap">{error}</p>
          </div>
      )}

      {mode === 'generate' && (
        <div className="flex-grow flex flex-col space-y-4 overflow-y-auto">
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-300">{t('timelessLyricsImporter.pasteLyrics')}</label>
            <textarea rows={8} className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500" placeholder={t('timelessLyricsImporter.placeholder')} value={rawLyrics} onChange={(e) => setRawLyrics(e.target.value)} disabled={isLoading} />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-300">{t('aiLyricCorrector.step2LlmPromptTemplate')}</label>
            <textarea rows={8} className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-green-500" value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)} disabled={isLoading} />
            <div className="text-xs text-gray-500 mt-1">
              {t('aiLyricCorrector.promptTemplateTagsHint')}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => setPromptPreview(promptTemplate.replace('{raw_lyrics}', rawLyrics))} className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50" disabled={isLoading}>
                {t('aiLyricCorrector.previewPromptButton')}
            </button>
            <button onClick={handleGenerate} disabled={isLoading || !rawLyrics.trim()} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50">
                {isLoading ? t('aiLyricCorrector.processingButton') : t('timelessLyricsImporter.generateButton')}
            </button>
          </div>
        </div>
      )}

      {mode === 'import' && (
        <div className="flex-grow flex flex-col space-y-4 overflow-y-auto">
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-300">{t('timelessLyricsImporter.pasteJson')}</label>
            <textarea rows={20} className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-green-500" placeholder={t('timelessLyricsImporter.jsonPlaceholder')} value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} />
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handleDirectImport} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500" disabled={!jsonInput.trim()}>
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
