// src/components/tutor/VocabCardEditor.tsx
import React, { useState, useEffect, useMemo } from 'react';
import useTutorStore from '@/stores/useTutorStore';
import useTemplateStore from '@/stores/useTemplateStore';
import useSettingsStore from '@/stores/useSettingsStore';
import ReactMarkdown from 'react-markdown';

interface VocabCardEditorProps {
  onClose: () => void;
}

const VocabCardEditor: React.FC<VocabCardEditorProps> = ({ onClose }) => {
  const { selectedTokens, sentence, explanation, addWordToVocabulary } = useTutorStore();
  const { cardTemplates, loadCardTemplates, addCardTemplate } = useTemplateStore();
  const { settings, updateSetting } = useSettingsStore();

  const [frontTemplate, setFrontTemplate] = useState('');
  const [backTemplate, setBackTemplate] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  const selectedWord = useMemo(() => selectedTokens.map(t => t.surface).join(''), [selectedTokens]);
  const selectedReading = useMemo(() => selectedTokens.map(t => t.reading).join(''), [selectedTokens]);
  const boldedSentence = useMemo(() => sentence.replace(selectedWord, `**${selectedWord}**`), [sentence, selectedWord]);
  
  useEffect(() => {
    loadCardTemplates();
  }, [loadCardTemplates]);

  useEffect(() => {
    const defaultTemplate = cardTemplates.find(t => t.id === settings.defaultCardTemplateId) || cardTemplates[0];
    if (defaultTemplate) {
      setSelectedTemplateId(defaultTemplate.id);
      setFrontTemplate(defaultTemplate.front);
      setBackTemplate(defaultTemplate.back);
    }
  }, [cardTemplates, settings.defaultCardTemplateId]);

  const renderContent = (template: string) => {
    return template
      .replace(/{word}/g, selectedWord)
      .replace(/{sentence}/g, sentence)
      .replace(/{reading}/g, selectedReading)
      .replace(/{llm_response}/g, explanation || '')
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
    const name = prompt('Enter a name for this new card template:');
    if (name && frontTemplate && backTemplate) {
      addCardTemplate(name, frontTemplate, backTemplate);
    }
  };
  
  const handleSetDefault = () => {
    if (selectedTemplateId) {
      updateSetting('defaultCardTemplateId', selectedTemplateId);
      alert('Default card template updated!');
    }
  };

  const handleSaveToVocab = () => {
    const finalFront = renderContent(frontTemplate);
    const finalBack = renderContent(backTemplate);
    addWordToVocabulary(finalFront, finalBack);
    onClose();
  };

  const placeholderInfo = (
    <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-900 rounded">
      <p className="font-bold">Available Placeholders:</p>
      <p>&#123;word&#125;, &#123;reading&#125;, &#123;sentence&#125;, &#123;llm_response&#125;, &#123;bold_sentence&#125;</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 text-white rounded-lg p-6 max-w-2xl w-full flex flex-col max-h-[95vh]">
        <h2 className="text-2xl font-bold mb-4">Save to Vocabulary</h2>

        <div className="flex justify-between items-center mb-4">
            <select value={selectedTemplateId || ''} onChange={handleTemplateChange} className="p-2 rounded bg-gray-700 border border-gray-600">
                {cardTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="flex gap-2">
                <button onClick={handleSetDefault} className="px-3 py-1 bg-sky-600 text-sm rounded hover:bg-sky-500">Set Default</button>
                <button onClick={handleSaveTemplate} className="px-3 py-1 bg-blue-600 text-sm rounded hover:bg-blue-500">Save as New</button>
                <button onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')} className="px-3 py-1 bg-indigo-600 text-sm rounded hover:bg-indigo-500 w-24">
                  {viewMode === 'edit' ? 'Preview' : 'Edit'}
                </button>
            </div>
        </div>
        
        <div className="flex-grow overflow-y-auto pr-2">
          {viewMode === 'edit' ? (
            <>
              <div className="mb-4">
                <label className="block text-lg font-semibold mb-1">Card Front Template</label>
                <textarea rows={5} className="w-full bg-gray-900 p-2 rounded border border-gray-600 font-mono text-sm" value={frontTemplate} onChange={(e) => setFrontTemplate(e.target.value)} />
              </div>
              <div className="mb-4">
                <label className="block text-lg font-semibold mb-1">Card Back Template</label>
                <textarea rows={8} className="w-full bg-gray-900 p-2 rounded border border-gray-600 font-mono text-sm" value={backTemplate} onChange={(e) => setBackTemplate(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="mb-4">
                <h3 className="block text-lg font-semibold mb-1 text-gray-400">Card Front Preview</h3>
                <div className="w-full bg-gray-900 p-3 rounded border border-gray-600 min-h-[124px] prose prose-invert">
                  <ReactMarkdown>{renderContent(frontTemplate)}</ReactMarkdown>
                </div>
              </div>
              <div className="mb-4">
                <h3 className="block text-lg font-semibold mb-1 text-gray-400">Card Back Preview</h3>
                <div className="w-full bg-gray-900 p-3 rounded border border-gray-600 min-h-[200px] whitespace-pre-wrap">{renderContent(backTemplate)}</div>
              </div>
            </>
          )}
          
          {placeholderInfo}
        </div>

        <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">Cancel</button>
          <button onClick={handleSaveToVocab} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500">Save Card</button>
        </div>
      </div>
    </div>
  );
};

export default VocabCardEditor;