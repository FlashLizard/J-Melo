// src/components/tutor/VocabCardEditor.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import useTutorStore from '@/stores/useTutorStore';
import useTemplateStore from '@/stores/useTemplateStore';
import useSettingsStore from '@/stores/useSettingsStore';
import useTranslation from '@/hooks/useTranslation';
import ReactMarkdown from 'react-markdown';
import cn from 'classnames';
import toast from 'react-hot-toast';

interface VocabCardEditorProps {
  onClose: () => void;
  t: (key: string, options?: { [key: string]: any }) => string;
}

const VocabCardEditor: React.FC<VocabCardEditorProps> = ({ onClose, t }) => {
  const { selectedTokens, sentence, explanation, addWordToVocabulary } = useTutorStore();
  const { cardTemplates, loadCardTemplates, addCardTemplate } = useTemplateStore();
  const { settings, updateSetting } = useSettingsStore();

  const [mounted, setMounted] = useState(false);
  const [frontTemplate, setFrontTemplate] = useState('');
  const [backTemplate, setBackTemplate] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  const selectedWord = useMemo(() => selectedTokens.map(t => t.surface).join(''), [selectedTokens]);
  const selectedReading = useMemo(() => selectedTokens.map(t => t.reading).join(''), [selectedTokens]);
  const boldedSentence = useMemo(() => sentence.replace(selectedWord, `**${selectedWord}**`), [sentence, selectedWord]);
  
  useEffect(() => {
    setMounted(true);
    loadCardTemplates();
    return () => setMounted(false);
  }, [loadCardTemplates]);

  useEffect(() => {
    const defaultTemplate = cardTemplates.find(t => t.id === settings.defaultCardTemplateId) || cardTemplates[0];
    if (defaultTemplate) {
      setSelectedTemplateId(defaultTemplate.id);
      setFrontTemplate(defaultTemplate.front);
      setBackTemplate(defaultTemplate.back);
    } else {
        setFrontTemplate(t('vocabCardEditor.defaultFrontTemplate'));
        setBackTemplate(t('vocabCardEditor.defaultBackTemplate'));
        setSelectedTemplateId(undefined);
    }
  }, [cardTemplates, settings.defaultCardTemplateId, t]);

  const renderContent = (template: string) => {
    return template
      .replace(/{word}/g, selectedWord)
      .replace(/{sentence}/g, sentence)
      .replace(/{reading}/g, selectedReading)
      .replace(/{llm_response}/g, explanation || t('common.na'))
      .replace(/{bold_sentence}/g, boldedSentence);
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value, 10);
    const template = cardTemplates.find(t => t.id === id);
    if (template) {
      setSelectedTemplateId(id);
      setFrontTemplate(template.front);
      setBackTemplate(template.back);
    }
  };

  const handleSaveTemplate = () => {
    const name = prompt(t('vocabCardEditor.enterTemplateNamePrompt'));
    if (name && frontTemplate && backTemplate) {
      addCardTemplate(name, frontTemplate, backTemplate);
      toast.success(t('vocabCardEditor.saveAsNewButton') + ' Success');
    }
  };
  
  const handleSetDefault = () => {
    if (selectedTemplateId) {
      updateSetting('defaultCardTemplateId', selectedTemplateId);
      toast.success(t('vocabCardEditor.setDefaultButton') + ' Success');
    }
  };

  const handleSaveToVocab = () => {
    const finalFront = renderContent(frontTemplate);
    const finalBack = renderContent(backTemplate);
    addWordToVocabulary(finalFront, finalBack);
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 w-full max-w-2xl h-full max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-white" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-700/50 bg-gray-900/50 flex-shrink-0">
            <h2 className="text-xl font-bold tracking-wide">{t('vocabCardEditor.title')}</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        {/* Controls Bar */}
        <div className="p-4 bg-gray-800 border-b border-gray-700/50 space-y-4 flex-shrink-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <select 
                    value={selectedTemplateId || ''} 
                    onChange={handleTemplateChange} 
                    className="w-full sm:w-auto flex-grow p-2.5 rounded-xl bg-gray-900 border border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                >
                    {cardTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                    <button 
                        onClick={handleSetDefault} 
                        className="flex items-center gap-1.5 flex-1 sm:flex-none p-2.5 sm:px-4 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors group text-xs font-medium"
                        title={t('vocabCardEditor.setDefaultButton')}
                    >
                        <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        {t('vocabCardEditor.setDefaultButton')}
                    </button>
                    <button 
                        onClick={handleSaveTemplate} 
                        className="flex items-center gap-1.5 flex-1 sm:flex-none p-2.5 sm:px-4 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors text-xs font-medium"
                        title={t('vocabCardEditor.saveAsNewButton')}
                    >
                        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {t('vocabCardEditor.saveAsNewButton')}
                    </button>
                    <button 
                        onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')} 
                        className={cn(
                            "flex items-center justify-center gap-1.5 flex-1 sm:flex-none p-2.5 sm:px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                            viewMode === 'edit' ? "bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-900/20" : "bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-900/20"
                        )}
                    >
                        {viewMode === 'edit' ? (
                            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>{t('vocabCardEditor.previewButton')}</>
                        ) : (
                            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>{t('vocabCardEditor.editButton')}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-grow overflow-y-auto p-5 custom-scrollbar bg-gray-900/20">
          {viewMode === 'edit' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1">{t('vocabCardEditor.cardFrontTemplateLabel')}</label>
                <textarea 
                    rows={4} 
                    className="w-full bg-gray-900/80 p-4 rounded-xl border border-gray-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none" 
                    value={frontTemplate} 
                    onChange={(e) => setFrontTemplate(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1">{t('vocabCardEditor.cardBackTemplateLabel')}</label>
                <textarea 
                    rows={8} 
                    className="w-full bg-gray-900/80 p-4 rounded-xl border border-gray-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none" 
                    value={backTemplate} 
                    onChange={(e) => setBackTemplate(e.target.value)} 
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{t('vocabCardEditor.cardFrontPreviewLabel')}</h3>
                <div className="w-full bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-inner prose prose-invert max-w-none text-center">
                  <ReactMarkdown>{renderContent(frontTemplate)}</ReactMarkdown>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{t('vocabCardEditor.cardBackPreviewLabel')}</h3>
                <div className="w-full bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-inner min-h-[200px] whitespace-pre-wrap leading-relaxed">
                    {renderContent(backTemplate)}
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-8 p-4 bg-indigo-900/20 rounded-2xl border border-indigo-500/20">
            <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {t('vocabCardEditor.placeholdersTitle')}
            </p>
            <div className="flex flex-wrap gap-2">
                {['word', 'reading', 'sentence', 'llm_response', 'bold_sentence'].map(p => (
                    <code key={p} className="px-2 py-1 bg-gray-900 rounded text-[10px] text-gray-300 border border-gray-700">&#123;{p}&#125;</code>
                ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-700/50 bg-gray-900/50 flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <button 
            onClick={onClose} 
            className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors font-medium"
          >
            {t('vocabCardEditor.cancelButton')}
          </button>
          <button 
            onClick={handleSaveToVocab} 
            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-500 rounded-xl transition-all font-bold shadow-lg shadow-green-900/20 active:scale-95"
          >
            {t('vocabCardEditor.saveCardButton')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VocabCardEditor;