// src/components/tutor/AIPanel.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import useTutorStore from '@/stores/useTutorStore';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useTemplateStore from '@/stores/useTemplateStore';
import useSettingsStore from '@/stores/useSettingsStore';
import useSongStore from '@/stores/useSongStore';
import useMobileViewStore from '@/stores/useMobileViewStore'; // Import useMobileViewStore
import useTranslation from '@/hooks/useTranslation'; // Import useTranslation
import { LyricToken } from '@/interfaces/lyrics';
import { copyToClipboard } from '@/utils/copyToClipboard'; // Import the utility
import cn from 'classnames';
import VocabCardEditor from './VocabCardEditor';
import toast from 'react-hot-toast';

// Define the Modal component within this file for simplicity, passing t prop
const Modal: React.FC<{ title: string; content: string; onClose: () => void; t: (key: string) => string }> = ({ title, content, onClose, t }) => {
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
        <div className="flex justify-end gap-2">
          <button
              onClick={() => {
                  copyToClipboard(content).then(() => {
                      toast.success(t('settings.tokenCopied') || 'Copied!');
                  }).catch(err => {
                      toast.error('Failed to copy content.');
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
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">{t('aiPanel.closeButton')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const AIPanel: React.FC = () => {
  const { sentence, tokens, selectedTokens, explanation, isLoading, getExplanation, setSelectedTokens, clearTutor, setExplanation } = useTutorStore();
  const { setActivePanel } = useUIPanelStore();
  const { setActiveView } = useMobileViewStore(); // Get setActiveView
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
    setActiveView('lyrics'); 
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
      toast.success(t('aiPanel.saveButton') + ' Success');
    }
  };
  
  const handleSetDefault = () => {
    if (selectedTemplateId) {
      updateSetting('defaultPromptTemplateId', selectedTemplateId);
      toast.success(t('aiPanel.setDefaultButton') + ' Success');
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

  const selectedWord = useMemo(() => (selectedTokens || []).map(t => t.surface).join(''), [selectedTokens]);

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
      <div className="bg-gray-800 p-4 sm:p-5 rounded-2xl h-full flex flex-col text-white border border-gray-700/50 shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-700/50 flex-shrink-0">
          <h2 className="text-xl font-bold tracking-wide">{t('aiPanel.title')}</h2>
          <button 
            onClick={handleBack} 
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            {t('aiPanel.backButton')}
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-5">
            
            {/* 1. Selection Area */}
            <div className="bg-gray-900/40 p-4 rounded-2xl border border-gray-700/50">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                  {t('aiPanel.selectWordsHint')}
              </h3>
              <p className="text-xl md:text-2xl tracking-widest leading-relaxed font-medium">
                {tokens.map((token, index) => {
                    const isSelected = selectedTokens.includes(token);
                    return (
                      <span 
                        key={`${token.surface}-${index}`} 
                        onClick={() => handleTokenClick(index)} 
                        className={cn(
                            "cursor-pointer px-1 py-0.5 rounded-lg transition-all duration-200 inline-block", 
                            isSelected ? "bg-indigo-500 text-white shadow-sm scale-105" : "text-gray-300 hover:bg-gray-700 hover:text-white"
                        )}
                      >
                        {token.surface}
                      </span>
                    )
                })}
              </p>
            </div>

            {/* 2. Prompt Configuration */}
            <div className="bg-gray-900/40 p-4 rounded-2xl border border-gray-700/50 flex flex-col">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                  {t('aiPanel.promptTemplateSectionTitle')}
              </h3>
              <textarea 
                rows={4} 
                className="w-full bg-gray-800/80 text-gray-200 p-3 rounded-xl border border-gray-700 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none custom-scrollbar mb-3" 
                value={currentPromptContent} 
                onChange={(e) => setCurrentPromptContent(e.target.value)} 
              />
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <select 
                    value={selectedTemplateId || ''} 
                    onChange={handleTemplateChange} 
                    className="w-full sm:w-auto flex-grow p-2 rounded-xl bg-gray-800 border border-gray-700 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                >
                  {promptTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                  <button onClick={handleSetDefault} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-xs rounded-xl hover:bg-gray-600 transition-colors" title={t('aiPanel.setDefaultTitle')}>
                      <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                      {t('aiPanel.setDefaultButton')}
                  </button>
                  <button onClick={handleSaveTemplate} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-xs rounded-xl hover:bg-gray-600 transition-colors">
                      <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {t('aiPanel.saveButton')}
                  </button>
                  <button onClick={handlePreview} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-xs rounded-xl hover:bg-gray-600 transition-colors font-medium">
                      <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      {t('aiPanel.previewButton')}
                  </button>
                </div>
              </div>
            </div>
            
            {/* 3. Output Area */}
            <div className="bg-gray-900/40 p-4 rounded-2xl border border-gray-700/50 flex flex-col flex-grow min-h-[250px]">
              <button 
                onClick={handleGetExplanation} 
                className={cn(
                    "w-full py-3 rounded-xl font-bold shadow-md transition-all active:scale-[0.98] mb-4 flex items-center justify-center gap-2",
                    isLoading ? "bg-indigo-800 text-indigo-300 cursor-wait" : "bg-indigo-600 hover:bg-indigo-500 text-white"
                )}
                disabled={isLoading}
              >
                {isLoading ? (
                    <><svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{t('aiPanel.thinkingButton')}</>
                ) : (
                    <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>{selectedWord ? t('aiPanel.explainWordButton', { word: selectedWord }) : t('aiPanel.explainSentenceButton')}</>
                )}
              </button>
              
              <div className="flex-grow relative">
                <textarea 
                    className="absolute inset-0 w-full h-full bg-gray-800/50 text-gray-100 p-4 rounded-xl border border-gray-700 focus:outline-none focus:border-indigo-500 transition-colors resize-none custom-scrollbar text-sm leading-relaxed"
                    value={explanation || ''}
                    onChange={(e) => setExplanation(e.target.value)}
                    disabled={isLoading}
                    placeholder={isLoading ? 'Waiting for AI...' : t('aiPanel.explanationPlaceholder')}
                />
              </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 pt-4 border-t border-gray-700/50 flex-shrink-0">
          <button 
            className="w-full py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold shadow-lg shadow-green-900/20 transition-all active:scale-[0.98] disabled:bg-gray-700 disabled:text-gray-500 disabled:shadow-none flex items-center justify-center gap-2" 
            onClick={() => setIsVocabEditorOpen(true)}
            disabled={!selectedWord}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
            {t('aiPanel.saveToVocabularyButton')}
          </button>
        </div>
      </div>
    </>
  );
};

export default AIPanel;