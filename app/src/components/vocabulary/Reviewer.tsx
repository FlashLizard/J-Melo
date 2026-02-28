// src/components/vocabulary/Reviewer.tsx
import React, { useState, useEffect } from 'react';
import useVocabularyStore from '@/stores/useVocabularyStore';
import ReactMarkdown from 'react-markdown';
import useTranslation from '@/hooks/useTranslation';
import cn from 'classnames';

const Reviewer: React.FC = () => {
  const { currentReviewCard, endReview, updateProficiency, drawNextCard, reviewWords } = useVocabularyStore();
  const [isFlipped, setIsFlipped] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    setIsFlipped(false);
  }, [currentReviewCard]);

  if (!currentReviewCard) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-700">
            <svg className="w-16 h-16 text-green-500 mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold mb-2 text-white">{t('reviewer.reviewCompleteTitle')}</h2>
            <p className="text-gray-400 mb-8">You have completed all cards for this session.</p>
            <button onClick={endReview} className="w-full px-6 py-3 bg-blue-600 rounded-xl hover:bg-blue-500 text-white font-bold transition-transform active:scale-95 shadow-md">
            {t('reviewer.returnToVocabularyButton')}
            </button>
        </div>
      </div>
    );
  }

  const handleProficiencyUpdate = async (change: number) => {
    await updateProficiency(currentReviewCard.id!, change);
    drawNextCard();
  };

  return (
    <div className="p-4 h-full flex flex-col max-w-4xl mx-auto w-full relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <div className="text-xs font-bold text-gray-400 bg-gray-900/50 px-3 py-1 rounded-full border border-gray-700 uppercase tracking-widest">
          Review Session
        </div>
        <button 
            onClick={endReview} 
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
            title={t('reviewer.endSessionButton')}
        >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      
      {/* Card Area - Flex-grow ensures it takes available space */}
      <div className="flex-grow flex items-center justify-center perspective-1000 w-full min-h-0 py-4">
        <div 
            className={cn(
                "relative w-full max-w-lg aspect-[3/4] sm:aspect-video transition-all duration-500 transform-style-3d cursor-pointer",
                isFlipped ? "rotate-y-180" : ""
            )}
            onClick={() => !isFlipped && setIsFlipped(true)}
        >
            {/* Front of Card */}
            <div className={cn(
                "absolute inset-0 backface-hidden bg-gray-800 rounded-2xl p-6 sm:p-10 flex flex-col justify-center items-center text-center shadow-xl border border-gray-700",
                isFlipped ? "pointer-events-none" : "z-10"
            )}>
              <div className="prose prose-invert prose-lg max-w-none">
                <ReactMarkdown>{currentReviewCard.cardFront}</ReactMarkdown>
              </div>
              <div className="absolute bottom-6 text-gray-500 text-xs font-medium uppercase tracking-tighter animate-pulse">
                  Tap to flip
              </div>
            </div>

            {/* Back of Card */}
            <div className={cn(
                "absolute inset-0 backface-hidden rotate-y-180 bg-gray-700 rounded-2xl p-6 sm:p-10 flex flex-col shadow-xl border border-blue-500/30 overflow-y-auto custom-scrollbar",
                !isFlipped ? "pointer-events-none" : "z-10"
            )}>
               <div className="flex-grow flex flex-col justify-center py-4">
                    <div className="prose prose-invert prose-sm opacity-50 text-center mb-6 pb-6 border-b border-gray-600/50">
                        <ReactMarkdown>{currentReviewCard.cardFront}</ReactMarkdown>
                    </div>
                    <div className="text-white text-lg sm:text-2xl font-medium leading-relaxed text-center whitespace-pre-wrap">
                        {currentReviewCard.cardBack}
                    </div>
               </div>
            </div>
        </div>
      </div>

      {/* Controls Area - Fixed at bottom */}
      <div className="mt-4 mb-2 flex-shrink-0 w-full max-w-2xl mx-auto min-h-[80px] flex items-center">
        {!isFlipped ? (
          <button 
            onClick={() => setIsFlipped(true)} 
            className="w-full py-4 bg-blue-600 rounded-xl hover:bg-blue-500 text-white text-lg font-bold shadow-lg transition-all active:scale-95"
          >
            {t('reviewer.showBackButton')}
          </button>
        ) : (
          <div className="w-full grid grid-cols-3 sm:grid-cols-6 gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
            <button 
                onClick={() => handleProficiencyUpdate(-10)} 
                className="p-3 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors flex flex-col items-center justify-center active:scale-95"
            >
                <span className="font-bold text-xs">{t('reviewer.lowestButton')}</span>
                <span className="text-[10px] opacity-70 font-mono">-10</span>
            </button>
            <button 
                onClick={() => handleProficiencyUpdate(-5)} 
                className="p-3 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition-colors flex flex-col items-center justify-center active:scale-95"
            >
                <span className="font-bold text-xs">Hard</span>
                <span className="text-[10px] opacity-70 font-mono">-5</span>
            </button>
            <button 
                onClick={() => handleProficiencyUpdate(-1)} 
                className="p-3 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors flex flex-col items-center justify-center active:scale-95"
            >
                <span className="font-bold text-xs">Okay</span>
                <span className="text-[10px] opacity-70 font-mono">-1</span>
            </button>
            <button 
                onClick={() => handleProficiencyUpdate(1)} 
                className="p-3 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors flex flex-col items-center justify-center active:scale-95"
            >
                <span className="font-bold text-xs">Good</span>
                <span className="text-[10px] opacity-70 font-mono">+1</span>
            </button>
            <button 
                onClick={() => handleProficiencyUpdate(5)} 
                className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors flex flex-col items-center justify-center active:scale-95"
            >
                <span className="font-bold text-xs">Easy</span>
                <span className="text-[10px] opacity-70 font-mono">+5</span>
            </button>
            <button 
                onClick={() => handleProficiencyUpdate(10)} 
                className="p-3 bg-sky-600 text-white rounded-lg hover:bg-sky-500 transition-colors flex flex-col items-center justify-center active:scale-95"
            >
                <span className="font-bold text-xs">{t('reviewer.highestButton')}</span>
                <span className="text-[10px] opacity-70 font-mono">+10</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reviewer;