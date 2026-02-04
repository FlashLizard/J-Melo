// src/components/vocabulary/CardViewer.tsx
import React, { useState, useEffect } from 'react';
import useVocabularyStore from '@/stores/useVocabularyStore';
import ReactMarkdown from 'react-markdown';
import { db } from '@/lib/db';

const CardViewer: React.FC = () => {
  const { isViewerOpen, viewerItems, currentViewerIndex, closeViewer, goToNextViewerItem, goToPrevViewerItem, updateViewerItem } = useVocabularyStore();
  const [isEditing, setIsEditing] = useState(false);
  
  const currentWord = viewerItems[currentViewerIndex];
  
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');

  useEffect(() => {
    if (currentWord) {
      setEditFront(currentWord.cardFront);
      setEditBack(currentWord.cardBack);
    }
  }, [currentWord]);

  if (!isViewerOpen || !currentWord) return null;

  const handleSave = async () => {
    const updatedWord = { ...currentWord, cardFront: editFront, cardBack: editBack };
    await db.words.put(updatedWord);
    updateViewerItem(updatedWord); // Update the state in the store
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditFront(currentWord.cardFront);
    setEditBack(currentWord.cardBack);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 text-white rounded-lg p-6 max-w-2xl w-full flex flex-col max-h-[95vh]">
        
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Vocabulary Card</h2>
          {isEditing ? (
            <div className="flex gap-2">
              <button onClick={handleSave} className="px-3 py-1 bg-green-600 text-sm rounded hover:bg-green-500">Save</button>
              <button onClick={handleCancel} className="px-3 py-1 bg-gray-600 text-sm rounded hover:bg-gray-500">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setIsEditing(true)} className="px-3 py-1 bg-blue-600 text-sm rounded hover:bg-blue-500">Edit</button>
          )}
        </div>

        {/* Card Content */}
        <div className="flex-grow overflow-y-auto pr-2">
          {isEditing ? (
            <>
              <div className="mb-4">
                <label className="block text-lg font-semibold mb-1">Card Front</label>
                <textarea rows={5} className="w-full bg-gray-900 p-2 rounded border border-gray-600 font-mono text-sm" value={editFront} onChange={(e) => setEditFront(e.target.value)} />
              </div>
              <div className="mb-4">
                <label className="block text-lg font-semibold mb-1">Card Back</label>
                <textarea rows={10} className="w-full bg-gray-900 p-2 rounded border border-gray-600 font-mono text-sm" value={editBack} onChange={(e) => setEditBack(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="mb-4">
                <h3 className="block text-lg font-semibold mb-1 text-gray-400">Front</h3>
                <div className="w-full bg-gray-900 p-3 rounded border border-gray-600 min-h-[124px] prose prose-invert max-w-none">
                  <ReactMarkdown>{currentWord.cardFront}</ReactMarkdown>
                </div>
              </div>
              <div className="mb-4">
                <h3 className="block text-lg font-semibold mb-1 text-gray-400">Back</h3>
                <div className="w-full bg-gray-900 p-3 rounded border border-gray-600 min-h-[200px] whitespace-pre-wrap">{currentWord.cardBack}</div>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
          <button onClick={goToPrevViewerItem} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">&larr; Previous</button>
          <span>{currentViewerIndex + 1} / {viewerItems.length}</span>
          <button onClick={goToNextViewerItem} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">Next &rarr;</button>
        </div>

        <button onClick={closeViewer} className="w-full mt-4 px-4 py-2 bg-red-700 rounded-lg hover:bg-red-600">Close Viewer</button>
      </div>
    </div>
  );
};

export default CardViewer;
