// src/components/tutor/LyricTranslationPanel.tsx
import React, { useState, useEffect } from 'react';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useMobileViewStore from '@/stores/useMobileViewStore';
import useTranslation from '@/hooks/useTranslation';
import useSongStore from '@/stores/useSongStore'; // Import useSongStore
import useSettingsStore from '@/stores/useSettingsStore'; // Import useSettingsStore
import { db } from '@/lib/db'; // Import db for settings
import { LyricLine } from '@/interfaces/lyrics'; // Import LyricLine interface
import cn from 'classnames';

type TranslationMode = 'mapProvided' | 'current';

// Define the Modal component within this file for simplicity, passing t prop
const Modal: React.FC<{ title: string; content: string; onClose: () => void; t: (key: string) => string; children?: React.ReactNode }> = ({ title, content, onClose, t, children }) => (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
    <div className="bg-gray-800 text-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] flex flex-col">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <div className="flex-grow overflow-y-auto bg-gray-900 p-4 rounded-md border border-gray-700 mb-4">
        <pre className="text-sm whitespace-pre-wrap">{content}</pre>
      </div>
      {children} {/* Render children here */}
      <div className="flex justify-end mt-4"> {/* Added mt-4 for spacing */}
        <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">{t('lyricTranslationPanel.closeButton')}</button>
      </div>
    </div>
  </div>
);

const TranslationPreviewModal: React.FC<{
  translatedLyrics: LyricLine[];
  rawLLMOutput: string;
  onConfirm: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}> = ({ translatedLyrics, rawLLMOutput, onConfirm, onCancel, t }) => (
  <Modal 
    title={t('lyricTranslationPanel.previewModalTitle')}
    content={`${t('lyricTranslationPanel.parsedJsonPreview')}:\n\n${JSON.stringify(translatedLyrics, null, 2)}\n\n---\n\n${t('lyricTranslationPanel.rawLlmOutput')}:\n\n${rawLLMOutput}`}
    onClose={onCancel}
    t={t}
  >
    <div className="flex justify-end space-x-2 mt-4">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">{t('lyricTranslationPanel.cancelButton')}</button>
        <button onClick={onConfirm} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500">{t('lyricTranslationPanel.applyTranslationButton')}</button>
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
      className="w-full h-48 bg-gray-900 text-white p-2 rounded border border-gray-600 font-mono text-xs"
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
    id: line.id,
    startTime: line.startTime,
    endTime: line.endTime,
    text: line.text,
    translation: line.translation, // Include existing translation if any
  }));
};

const DEFAULT_PROVIDED_LYRICS_PROMPT = `You are an expert in Japanese and Chinese translation. A user has provided Chinese lyrics and the corresponding simplified JSON lyrics with timing information. Your task is to map each provided Chinese sentence to the 'translation' field of the corresponding 'LyricLine' object in the simplified JSON structure.

The user-provided Chinese lyrics to map are:
---
{provided_lyrics}
---

The simplified JSON lyrics with timing information are (id, startTime, endTime, text, translation):
---
{original_lyrics_json}
---

Please output a JSON object that strictly follows the simplified JSON structure, but with the 'translation' field of each 'LyricLine' object updated with the Chinese translation from the provided lyrics. Assume the number of lines in provided_lyrics matches the number of lines in original_lyrics_json, and map them in order. The JSON should be enclosed in a single markdown code block. Ensure the other fields (id, startTime, endTime, text) remain unchanged.`;

const DEFAULT_CURRENT_LYRICS_PROMPT = `You are an expert in Japanese and Chinese translation. A user has provided simplified JSON Japanese song lyrics with timing information. Your task is to translate the Japanese text of each 'LyricLine' object into Chinese and update the 'translation' field for each corresponding 'LyricLine' object.

The simplified JSON lyrics with timing information are (id, startTime, endTime, text, translation):
---
{original_lyrics_json}
---

Please output a JSON object that strictly follows the simplified JSON structure, but with the 'translation' field of each 'LyricLine' object updated with the Chinese translation. The JSON should be enclosed in a single markdown code block. Ensure the other fields (id, startTime, endTime, text) remain unchanged.`;


const LyricTranslationPanel: React.FC = () => {
  const { lyrics, song, updateLyricTranslations } = useSongStore();
  const { setActivePanel } = useUIPanelStore();
  const { setActiveView } = useMobileViewStore();
  const { t } = useTranslation();
  const { settings } = useSettingsStore();

  const [translationMode, setTranslationMode] = useState<TranslationMode>('current');
  const [providedLyrics, setProvidedLyrics] = useState('');
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_CURRENT_LYRICS_PROMPT); // Default to current lyrics mode
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ translatedLyrics: LyricLine[], rawLLMOutput: string } | null>(null);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [editableLlmOutput, setEditableLlmOutput] = useState<string>('');

  useEffect(() => {
    if (translationMode === 'mapProvided') {
      setPromptTemplate(DEFAULT_PROVIDED_LYRICS_PROMPT);
    } else {
      setPromptTemplate(DEFAULT_CURRENT_LYRICS_PROMPT);
    }
  }, [translationMode]);

  const handleBack = () => {
    setActivePanel('TOOL_PANEL');
    setActiveView('lyrics'); // Always go back to lyrics view on mobile
  };

  const parseLlmOutput = (output: string) => {
    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = output.match(jsonRegex);
    if (!match || !match[1]) {
      throw new Error(t('lyricTranslationPanel.jsonNotFoundInResponse'));
    }
    return JSON.parse(match[1]) as LyricLine[];
  };

  const handleTranslate = async () => {
    setIsLoading(true);
    setError(null);
    setEditableLlmOutput('');
    setPreviewData(null);

    if (!song || !lyrics) {
        setError(t('lyricTranslationPanel.noSongLoaded'));
        setIsLoading(false);
        return;
    }

    try {
      const storedSettings = await db.settings.get(0);
      const apiKey = storedSettings?.translationLLMApiKey || storedSettings?.openaiApiKey;
      const apiUrl = storedSettings?.translationLLMApiUrl || storedSettings?.llmApiUrl || 'https://api.openai.com/v1/chat/completions';
      const modelType = storedSettings?.translationLLMModelType || storedSettings?.llmModelType || 'gpt-3.5-turbo';
      const targetLanguage = storedSettings?.targetTranslationLanguage || 'English'; // Use targetTranslationLanguage from settings

      if (!apiKey) throw new Error(t('lyricTranslationPanel.apiKeyNotSet'));
      if (translationMode === 'mapProvided' && !providedLyrics.trim()) throw new Error(t('lyricTranslationPanel.pasteProvidedLyricsHint'));

      const simplifiedLyricsJson = JSON.stringify(getSimplifiedLyricsJson(lyrics), null, 2); // Use simplified JSON
      let finalPrompt = promptTemplate
        .replace(/{original_lyrics_json}/g, simplifiedLyricsJson);

      if (translationMode === 'mapProvided') {
        finalPrompt = finalPrompt.replace(/{provided_lyrics}/g, providedLyrics);
      }
      
      finalPrompt = finalPrompt.replace(/{target_language}/g, targetLanguage);


      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelType, messages: [{ role: 'user', content: finalPrompt }], temperature: 0.2 }),
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
    if (!song || !lyrics) {
        alert(t('lyricTranslationPanel.noSongLoaded'));
        return;
    }
    const simplifiedLyricsJson = JSON.stringify(getSimplifiedLyricsJson(lyrics), null, 2);
    let finalPrompt = promptTemplate
      .replace(/{original_lyrics_json}/g, simplifiedLyricsJson);
    if (translationMode === 'mapProvided') {
      finalPrompt = finalPrompt.replace(/{provided_lyrics}/g, providedLyrics);
    }
    setPromptPreview(finalPrompt);
  };
  
  const handleConfirmTranslation = async () => {
    if (previewData) {
      await updateLyricTranslations(previewData.translatedLyrics); // Use updateLyricTranslations
      alert(t('lyricTranslationPanel.translationAppliedSuccess'));
    }
    setPreviewData(null);
    setActivePanel('TOOL_PANEL');
    setActiveView('lyrics');
  };

  return (
    <>
      {previewData && (
        <TranslationPreviewModal
          translatedLyrics={previewData.translatedLyrics}
          rawLLMOutput={previewData.rawLLMOutput}
          onConfirm={handleConfirmTranslation}
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
      <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col text-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{t('lyricTranslationPanel.title')}</h2>
          <button onClick={handleBack} className="px-3 py-1 bg-gray-600 rounded-lg hover:bg-gray-500 text-sm">
            {t('lyricTranslationPanel.backButton')}
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
              <h3 className="font-bold text-red-200">{t('lyricTranslationPanel.errorOccurred')}</h3>
              <p className="text-red-200 text-sm whitespace-pre-wrap">{error}</p>
            </div>
        )}

        <div className="flex-grow flex flex-col space-y-4 overflow-y-auto">
          {/* Mode Selection */}
          <div className="bg-gray-700 p-3 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">{t('lyricTranslationPanel.selectModeTitle')}</h3>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio text-green-500"
                  name="translationMode"
                  value="current"
                  checked={translationMode === 'current'}
                  onChange={() => setTranslationMode('current')}
                  disabled={isLoading || !song || !lyrics} // Disable if no song or lyrics
                />
                <span className="ml-2">{t('lyricTranslationPanel.modeCurrentLyrics')}</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio text-green-500"
                  name="translationMode"
                  value="mapProvided"
                  checked={translationMode === 'mapProvided'}
                  onChange={() => setTranslationMode('mapProvided')}
                  disabled={isLoading || !song || !lyrics} // Disable if no song or lyrics
                />
                <span className="ml-2">{t('lyricTranslationPanel.modeMapProvidedTranslations')}</span>
              </label>
            </div>
          </div>

          {/* Provided Lyrics Input */}
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

          {/* Prompt Template */}
          <div className="flex flex-col">
            <label htmlFor="prompt-template" className="text-sm font-semibold mb-1 text-gray-300">
              {t('lyricTranslationPanel.step2LlmPromptTemplate')}
            </label>
            <textarea
              id="prompt-template"
              rows={8}
              className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700 font-mono text-xs"
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              disabled={isLoading}
            />
             <div className="text-xs text-gray-500 mt-1">
              {t('lyricTranslationPanel.promptTemplateTagsHint')}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 disabled:opacity-50"
            onClick={handleBack}
            disabled={isLoading}
          >
            {t('lyricTranslationPanel.backButton')}
          </button>
          <button
            className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50"
            onClick={handlePreviewPrompt}
            disabled={isLoading || !song || !lyrics} // Disable if no song or lyrics
          >
            {t('lyricTranslationPanel.previewPromptButton')}
          </button>
          <button
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50"
            onClick={handleTranslate}
            disabled={isLoading || !song || !lyrics || (translationMode === 'mapProvided' && !providedLyrics.trim())} // Disable if no song or lyrics
          >
            {isLoading ? t('lyricTranslationPanel.processingButton') : t('lyricTranslationPanel.translateButton')}
          </button>
        </div>
      </div>
    </>
  );
};

export default LyricTranslationPanel;