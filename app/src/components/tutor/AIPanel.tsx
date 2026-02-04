// src/components/tutor/AIPanel.tsx
import React, { useState, useEffect, useMemo } from 'react';
import useTutorStore from '@/stores/useTutorStore';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useTemplateStore from '@/stores/useTemplateStore';
import useSettingsStore from '@/stores/useSettingsStore';
import useSongStore from '@/stores/useSongStore';
import useTranslation from '@/hooks/useTranslation'; // Import useTranslation
import { LyricToken } from '@/interfaces/lyrics';
import cn from 'classnames';
import VocabCardEditor from './VocabCardEditor';

// Define the Modal component within this file for simplicity, passing t prop
const Modal: React.FC<{ title: string; content: string; onClose: () => void; t: (key: string) => string }> = ({ title, content, onClose, t }) => (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
    <div className="bg-gray-800 text-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] flex flex-col">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <div className="flex-grow overflow-y-auto bg-gray-900 p-4 rounded-md border border-gray-700 mb-4">
        <pre className="text-sm whitespace-pre-wrap">{content}</pre>
      </div>
      <div className="flex justify-end">
        <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">{t('aiPanel.closeButton')}</button>
      </div>
    </div>
  </div>
);

const AIPanel: React.FC = () => {
  const { sentence, tokens, selectedTokens, explanation, isLoading, getExplanation, setSelectedTokens, clearTutor, setExplanation } = useTutorStore();
  const { setActivePanel } = useUIPanelStore();
  const { promptTemplates, loadPromptTemplates, addPromptTemplate } = useTemplateStore();
  const { settings, updateSetting, loadSettings } = useSettingsStore();
  const song = useSongStore((state) => state.song);
  const { t } = useTranslation(); // Initialize useTranslation

  const [selectionStartIndex, setSelectionStartIndex] = useState<number | null>(null);
  const [currentPromptContent, setCurrentPromptContent] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [isVocabEditorOpen, setIsVocabEditorOpen] = useState(false);

  useEffect(() => {
    loadSettings();
    loadPromptTemplates();
  }, [loadSettings, loadPromptTemplates]);

  useEffect(() => {
    const defaultTemplate = promptTemplates.find(t => t.id === settings.defaultPromptTemplateId) || promptTemplates[0];
    if (defaultTemplate) {
      setCurrentPromptContent(defaultTemplate.content);
      setSelectedTemplateId(defaultTemplate.id);
    } else {
        // Fallback to a default string if no templates are loaded yet
        setCurrentPromptContent(t('aiPanel.defaultPromptContent'));
        setSelectedTemplateId(undefined);
    }
  }, [promptTemplates, settings.defaultPromptTemplateId, t]);
  
  useEffect(() => {
    setSelectionStartIndex(null);
  }, [sentence]);

  const handleTokenClick = (index: number) => {
    if (selectionStartIndex === null) {
      setSelectionStartIndex(index);
      setSelectedTokens([tokens[index]]);
    } else {
      const start = Math.min(selectionStartIndex, index);
      const end = Math.max(selectionStartIndex, index);
      setSelectedTokens(tokens.slice(start, end + 1));
      setSelectionStartIndex(null);
    }
  };

  const handleBack = () => {
    clearTutor();
    setActivePanel('TOOL_PANEL');
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value, 10);
    const template = promptTemplates.find(t => t.id === id);
    if (template) {
      setCurrentPromptContent(template.content);
      setSelectedTemplateId(id);
    }
  };

  const handleSaveTemplate = () => {
    const name = prompt(t('aiPanel.enterTemplateNamePrompt'));
    if (name) {
      addPromptTemplate(name, currentPromptContent);
    }
  };
  
  const handleSetDefault = () => {
    if (selectedTemplateId) {
      updateSetting('defaultPromptTemplateId', selectedTemplateId);
      alert(t('aiPanel.defaultTemplateUpdatedAlert'));
    }
  };

  const generateFinalPrompt = () => {
    const word = selectedTokens.map(t => t.surface).join('');
    const reading = selectedTokens.map(t => t.reading).join('');
    return currentPromptContent
      .replace(/{word}/g, word)
      .replace(/{reading}/g, reading)
      .replace(/{sentence}/g, sentence)
      .replace(/{song_title}/g, song?.title || t('common.na'))
      .replace(/{song_artist}/g, song?.artist || t('common.na'));
  };

  const handlePreview = () => setPromptPreview(generateFinalPrompt());
  
  const handleGetExplanation = () => {
    const finalPrompt = generateFinalPrompt();
    getExplanation(finalPrompt);
  };

  const selectedWord = useMemo(() => selectedTokens.map(t => t.surface).join(''), [selectedTokens]);

  return (
    <>
      {isVocabEditorOpen && <VocabCardEditor onClose={() => setIsVocabEditorOpen(false)} t={t} />}

      {promptPreview && (
        <Modal 
          title={t('aiPanel.promptPreviewTitle')}
          content={promptPreview}
          onClose={() => setPromptPreview(null)}
          t={t}
        />
      )}
      <div className="h-full bg-gray-800 text-white p-4 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{t('aiPanel.title')}</h2>
          <button onClick={handleBack} className="px-3 py-1 bg-gray-600 rounded-lg hover:bg-gray-500 text-sm">{t('aiPanel.backButton')}</button>
        </div>

        <div className="bg-gray-700 p-3 rounded-lg mb-4">
          <h3 className="text-sm text-gray-400 mb-2">{t('aiPanel.selectWordsHint')}</h3>
          <p className="text-xl tracking-wider">
            {tokens.map((token, index) => (
              <span key={`${token.surface}-${index}`} onClick={() => handleTokenClick(index)} className={cn("cursor-pointer p-1 rounded transition-colors", { "bg-yellow-500/30": selectedTokens.includes(token), "hover:bg-gray-600": !selectedTokens.includes(token) })}>{token.surface}</span>
            ))}
          </p>
        </div>

        <div className="bg-gray-700 p-3 rounded-lg mb-4">
          <h3 className="text-lg font-semibold mb-2">{t('aiPanel.promptTemplateSectionTitle')}</h3>
          <textarea rows={6} className="w-full bg-gray-900 text-white p-2 rounded border border-gray-600 font-mono text-xs" value={currentPromptContent} onChange={(e) => setCurrentPromptContent(e.target.value)} />
          <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-900/50 rounded">
            <p className="font-bold">{t('aiPanel.placeholdersTitle')}:</p>
            <p>&#123;word&#125;, &#123;reading&#125;, &#123;sentence&#125;, &#123;song_title&#125;, &#123;song_artist&#125;</p>
          </div>
          <div className="flex justify-between items-center mt-2">
            <select value={selectedTemplateId || ''} onChange={handleTemplateChange} className="p-1 rounded bg-gray-800 border border-gray-600 text-xs">
              {promptTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={handleSetDefault} className="px-2 py-1 bg-sky-600 text-xs rounded hover:bg-sky-500" title={t('aiPanel.setDefaultTitle')}>{t('aiPanel.setDefaultButton')}</button>
              <button onClick={handleSaveTemplate} className="px-2 py-1 bg-blue-600 text-xs rounded hover:bg-blue-500">{t('aiPanel.saveButton')}</button>
              <button onClick={handlePreview} className="px-2 py-1 bg-indigo-600 text-xs rounded hover:bg-indigo-500">{t('aiPanel.previewButton')}</button>
            </div>
          </div>
        </div>
        
        <div className="flex-grow flex flex-col bg-gray-700 p-3 rounded-lg">
          <button onClick={handleGetExplanation} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 w-full mb-3 disabled:bg-gray-500" disabled={isLoading || selectedTokens.length === 0}>
            {isLoading ? t('aiPanel.thinkingButton') : t('aiPanel.explainWordButton', { word: selectedWord })}
          </button>
          <textarea 
            rows={8}
            className="flex-grow bg-gray-900 p-2 rounded overflow-y-auto text-sm whitespace-pre-wrap"
            value={explanation || ''}
            onChange={(e) => setExplanation(e.target.value)}
            disabled={isLoading}
            placeholder={isLoading ? '...' : t('aiPanel.explanationPlaceholder')}
          />
        </div>

        <div className="mt-4">
          <button 
            className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-500 w-full disabled:bg-gray-500" 
            onClick={() => setIsVocabEditorOpen(true)}
            disabled={!selectedWord || !explanation}
          >
            {t('aiPanel.saveToVocabularyButton')}
          </button>
        </div>
      </div>
    </>
  );
};

export default AIPanel;
