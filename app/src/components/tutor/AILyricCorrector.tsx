// src/components/tutor/AILyricCorrector.tsx
import React, { useState } from 'react';
import useUIPanelStore from '@/stores/useUIPanelStore';
import { db } from '@/lib/db';
import useSongStore, { songStoreActions } from '@/stores/useSongStore';
import { LyricLine } from '@/interfaces/lyrics';

const Modal: React.FC<{ title: string; content: string; onClose: () => void; }> = ({ title, content, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
    <div className="bg-gray-800 text-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] flex flex-col">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <div className="flex-grow overflow-y-auto bg-gray-900 p-4 rounded-md border border-gray-700 mb-4">
        <pre className="text-sm whitespace-pre-wrap">{content}</pre>
      </div>
      <div className="flex justify-end">
        <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">Close</button>
      </div>
    </div>
  </div>
);

const LyricPreviewModal: React.FC<{
  newLyrics: LyricLine[];
  rawLLMOutput: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ newLyrics, rawLLMOutput, onConfirm, onCancel }) => (
  <Modal 
    title="Preview Corrected Lyrics"
    content={`PARSED JSON PREVIEW:\n\n${JSON.stringify(newLyrics, null, 2)}\n\n---\n\nRAW LLM OUTPUT:\n\n${rawLLMOutput}`}
    onClose={onCancel}
  />
);

const ErrorEditing: React.FC<{
  errorMessage: string;
  rawOutput: string;
  onRawOutputChange: (newOutput: string) => void;
  onRevalidate: () => void;
}> = ({ errorMessage, rawOutput, onRawOutputChange, onRevalidate }) => (
  <div className="bg-red-800 border border-red-600 p-3 rounded-md mb-4">
    <h3 className="font-bold text-red-200">An Error Occurred</h3>
    <p className="text-red-200 text-sm whitespace-pre-wrap mb-2">{errorMessage}</p>
    <h4 className="font-semibold text-white mt-4 mb-1">Edit Raw LLM Output:</h4>
    <textarea
      className="w-full h-48 bg-gray-900 text-white p-2 rounded border border-gray-600 font-mono text-xs"
      value={rawOutput}
      onChange={(e) => onRawOutputChange(e.target.value)}
    />
    <button
      onClick={onRevalidate}
      className="mt-2 px-4 py-2 w-full bg-yellow-600 rounded-lg hover:bg-yellow-500 text-white font-bold"
    >
      Re-validate
    </button>
  </div>
);

const AILyricCorrector: React.FC = () => {
  const { lyrics } = useSongStore();
  const [correctLyrics, setCorrectLyrics] = useState('');
  const [promptTemplate, setPromptTemplate] = useState(
    `You are an expert in audio transcription and Japanese lyrics. A user has provided a potentially inaccurate transcription of a song. They have also provided a block of text containing the correct lyrics, and the original JSON data to use as a timing reference.\n\nYour task is to listen to the song audio and produce a new, perfectly accurate, time-coded JSON transcription.\n\nThe user-provided correct lyrics are:\n---\n{correct_lyrics}\n---\n\nThe original, potentially inaccurate JSON is:\n---\n{original_lyrics_json}\n---\n\nPlease output a JSON object that follows the specified format. The JSON should be enclosed in a single markdown code block.\n\nThe format is an array of "lyric lines". Each line object must contain:\n- "startTime": The start time of the sentence in seconds.\n- "endTime": The end time of the sentence in seconds.\n- "text": The full Japanese text of the sentence.\n- "tokens": An array of word objects.\n\nEach word object in the "tokens" array must contain:\n- "surface": The Japanese word.\n- "reading": The hiragana reading of the word.\n- "startTime": The start time of the word in seconds.\n- "endTime": The end time of the word in seconds.`
  );
  const { setActivePanel } = useUIPanelStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ newLyrics: LyricLine[], rawLLMOutput: string } | null>(null);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [editableLlmOutput, setEditableLlmOutput] = useState<string>('');

  const parseLlmOutput = (output: string) => {
    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = output.match(jsonRegex);
    if (!match || !match[1]) {
      throw new Error(`Failed to find JSON in the LLM's response.`);
    }
    return JSON.parse(match[1]) as LyricLine[];
  };

  const handleSmartFix = async () => {
    setIsLoading(true);
    setError(null);
    setEditableLlmOutput('');
    setPreviewData(null);
  
    try {
      const settings = await db.settings.get(0);
      const apiKey = settings?.lyricFixLLMApiKey || settings?.openaiApiKey;
      const apiUrl = settings?.lyricFixLLMApiUrl || settings?.llmApiUrl || 'https://api.openai.com/v1/chat/completions';
      const modelType = settings?.lyricFixLLMModelType || settings?.llmModelType || 'gpt-3.5-turbo';
  
      if (!apiKey) throw new Error('API key is not set. Please configure it in the settings.');
      if (!correctLyrics.trim()) throw new Error('Please paste the correct lyrics into the input box.');
  
      const originalLyricsJson = JSON.stringify(lyrics, null, 2);
      const finalPrompt = promptTemplate
        .replace('{correct_lyrics}', correctLyrics)
        .replace('{original_lyrics_json}', originalLyricsJson);
  
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelType, messages: [{ role: 'user', content: finalPrompt }], temperature: 0.2 }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`LLM API Error: ${errorData.error?.message || 'Failed to fetch'}`);
      }
  
      const result = await response.json();
      const llmOutput = result.choices[0]?.message?.content;
  
      if (!llmOutput) throw new Error('LLM returned an empty response.');
      
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
      setError(`Re-validation failed: ${(e as Error).message}`);
    }
  };

  const handlePreviewPrompt = () => {
    const originalLyricsJson = JSON.stringify(lyrics, null, 2);
    const finalPrompt = promptTemplate
      .replace('{correct_lyrics}', correctLyrics)
      .replace('{original_lyrics_json}', originalLyricsJson);
    setPromptPreview(finalPrompt);
  };
  
  const handleConfirm = () => {
    if (previewData) {
      songStoreActions.setProcessedLyrics(previewData.newLyrics);
      alert('Lyrics have been updated successfully!');
    }
    setPreviewData(null);
    setActivePanel('TOOL_PANEL');
  };
  
  return (
    <>
      {previewData && (
        <LyricPreviewModal
          newLyrics={previewData.newLyrics}
          rawLLMOutput={previewData.rawLLMOutput}
          onConfirm={handleConfirm}
          onCancel={() => setPreviewData(null)}
        />
      )}
      {promptPreview && (
        <Modal 
          title="LLM Prompt Preview"
          content={promptPreview}
          onClose={() => setPromptPreview(null)}
        />
      )}
      <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col text-white">
        <h2 className="text-xl font-bold mb-4">AI Lyric Correction</h2>
        
        {error && editableLlmOutput && (
          <ErrorEditing 
            errorMessage={error}
            rawOutput={editableLlmOutput}
            onRawOutputChange={setEditableLlmOutput}
            onRevalidate={handleRevalidate}
          />
        )}
        {error && !editableLlmOutput && (
           <div className="bg-red-800 border border-red-600 p-3 rounded-md mb-4">
              <h3 className="font-bold text-red-200">An Error Occurred</h3>
              <p className="text-red-200 text-sm whitespace-pre-wrap">{error}</p>
            </div>
        )}

        <div className="flex-grow flex flex-col space-y-4 overflow-y-auto">
          <div className="flex flex-col">
            <label htmlFor="correct-lyrics" className="text-sm font-semibold mb-1 text-gray-300">
              1. Paste Correct Lyrics
            </label>
            <textarea
              id="correct-lyrics"
              rows={8}
              className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Paste the known correct lyrics here. Any format is okay."
              value={correctLyrics}
              onChange={(e) => setCorrectLyrics(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="prompt-template" className="text-sm font-semibold mb-1 text-gray-300">
              2. LLM Prompt Template
            </label>
            <textarea
              id="prompt-template"
              rows={8}
              className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              disabled={isLoading}
            />
             <div className="text-xs text-gray-500 mt-1">
              Use the &#123;correct_lyrics&#125; and &#123;original_lyrics_json&#125; tags.
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 disabled:opacity-50"
            onClick={() => setActivePanel('TOOL_PANEL')}
            disabled={isLoading}
          >
            Back
          </button>
          <button
            className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50"
            onClick={handlePreviewPrompt}
            disabled={isLoading}
          >
            Preview Prompt
          </button>
          <button
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50"
            onClick={handleSmartFix}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Smart Fix'}
          </button>
        </div>
      </div>
    </>
  );
};

export default AILyricCorrector;
