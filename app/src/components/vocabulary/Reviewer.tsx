// src/components/vocabulary/Reviewer.tsx
import React, { useState, useEffect } from 'react';
import useVocabularyStore from '@/stores/useVocabularyStore';
import ReactMarkdown from 'react-markdown';
import useTranslation from '@/hooks/useTranslation'; // Import useTranslation

const Reviewer: React.FC = () => {
  const { currentReviewCard, endReview, updateProficiency, drawNextCard } = useVocabularyStore();
  const [isFlipped, setIsFlipped] = useState(false);
  const { t } = useTranslation(); // Initialize useTranslation

  useEffect(() => {
    setIsFlipped(false);
  }, [currentReviewCard]);

  if (!currentReviewCard) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold mb-4">{t('reviewer.reviewCompleteTitle')}</h2>
        <button onClick={endReview} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-500">
          {t('reviewer.returnToVocabularyButton')}
        </button>
      </div>
    );
  }

  const handleProficiencyUpdate = async (change: number) => {
    await updateProficiency(currentReviewCard.id!, change);
    drawNextCard();
  };

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex justify-end mb-4">
        <button onClick={endReview} className="text-sm text-gray-400 hover:text-white">{t('reviewer.endSessionButton')}</button>
      </div>
      
      <div className="flex-grow flex items-center justify-center">
        <div className="w-full max-w-2xl bg-gray-800 rounded-lg p-6 min-h-[300px] flex flex-col justify-center items-center text-center">
          {!isFlipped ? (
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown>{currentReviewCard.cardFront}</ReactMarkdown>
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{currentReviewCard.cardBack}</div>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        {!isFlipped ? (
          <button onClick={() => setIsFlipped(true)} className="w-full max-w-xs px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 text-lg font-bold">
            {t('reviewer.showBackButton')}
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2 w-full max-w-2xl">
            <button onClick={() => handleProficiencyUpdate(-10)} className="p-3 bg-red-600 rounded-lg hover:bg-red-500">{t('reviewer.lowestButton')}</button>
            <button onClick={() => handleProficiencyUpdate(-1)} className="p-3 bg-orange-600 rounded-lg hover:bg-orange-500">-1</button>
            <button onClick={() => handleProficiencyUpdate(1)} className="p-3 bg-green-600 rounded-lg hover:bg-green-500">+1</button>
            <button onClick={() => handleProficiencyUpdate(10)} className="p-3 bg-sky-600 rounded-lg hover:bg-sky-500">{t('reviewer.highestButton')}</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reviewer;