// src/components/tutor/AIPanel.tsx
import React from 'react';
import useTutorStore, { tutorStoreActions } from '@/stores/useTutorStore';

const AIPanel: React.FC = () => {
  const { selectedText, explanation, isLoading, error } = useTutorStore();

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
    return (
      <p className="text-gray-400">
        Right-click on a word in the lyrics to get an AI-powered explanation.
      </p>
    );
  };

  return (
    <div className="h-full bg-gray-800 text-white p-4 flex flex-col">
      <h2 className="text-xl font-bold mb-4">AI Tutor</h2>
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