// src/components/tutor/AIPanel.tsx
import React from 'react';
import useTutorStore, { tutorStoreActions } from '@/stores/useTutorStore';
import useUIPanelStore from '@/stores/useUIPanelStore';

const AIPanel: React.FC = () => {
  const { selectedText, explanation, isLoading, error } = useTutorStore();
  const { setActivePanel } = useUIPanelStore();

  const handleBack = () => {
    tutorStoreActions.clearTutor();
    setActivePanel('TOOL_PANEL');
  };

  const renderContent = () => {
    if (isLoading) {
      return <p className="text-gray-400">Loading explanation...</p>;
    }
    if (error) {
      return <p className="text-red-500">{error}</p>;
    }
    if (explanation) {
      return <p className="whitespace-pre-wrap">{explanation}</p>;
    }
    if (selectedText) {
      return <p className="text-gray-400">Fetching explanation for "{selectedText}"...</p>;
    }
    // This state should ideally not be reached if the panel logic is correct
    return (
      <p className="text-gray-400">
        An unexpected error occurred. Please close this panel.
      </p>
    );
  };

  return (
    <div className="h-full bg-gray-800 text-white p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">AI Tutor</h2>
        <button
          onClick={handleBack}
          className="px-3 py-1 bg-gray-600 rounded-lg hover:bg-gray-500 text-sm"
        >
          Back
        </button>
      </div>
      <div className="bg-gray-700 p-4 rounded-lg flex-grow overflow-y-auto">
        {renderContent()}
      </div>
      <div className="mt-4">
        <button
          onClick={tutorStoreActions.addWordToVocabulary}
          className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 w-full disabled:bg-gray-500"
          disabled={!explanation || isLoading}
        >
          Add to Vocabulary
        </button>
      </div>
    </div>
  );
};

export default AIPanel;
