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
            <p className="text-gray-400 mb-8">{t('reviewer.completedDescription')}</p>
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
          {t('reviewer.reviewSession')}
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
      <div className="flex-grow flex items-center justify-center perspective-1000 w-full min-h-[300px] py-4">
        <div 
            className={cn(
                "relative w-full h-full min-h-[300px] max-w-lg md:max-w-3xl lg:max-w-4xl transition-all duration-500 transform-style-3d cursor-pointer group",
                isFlipped ? "rotate-y-180" : ""
            )}
            onClick={() => !isFlipped && setIsFlipped(true)}
        >
            {/* Front of Card */}
            <div className={cn(
                "absolute inset-0 backface-hidden bg-gray-800 rounded-[2rem] p-8 md:p-16 flex flex-col justify-center items-center text-center shadow-2xl border border-gray-700/50 hover:border-gray-600 transition-colors",
                "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/5 before:to-transparent before:rounded-[2rem] before:pointer-events-none",
                isFlipped ? "pointer-events-none" : "z-10"
            )}>
              <div className="prose prose-invert prose-2xl md:prose-3xl max-w-none font-medium tracking-wide">
                <ReactMarkdown>{currentReviewCard.cardFront}</ReactMarkdown>
              </div>
              <div className="absolute bottom-8 text-gray-500 text-sm font-bold uppercase tracking-[0.2em] animate-pulse flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                  {t('reviewer.tapToFlip')}
              </div>
            </div>

            {/* Back of Card */}
            <div className={cn(
                "absolute inset-0 backface-hidden rotate-y-180 bg-gray-800 rounded-[2rem] p-8 md:p-16 flex flex-col shadow-2xl border border-blue-500/20 overflow-hidden",
                "after:absolute after:inset-0 after:bg-gradient-to-b after:from-transparent after:to-blue-900/10 after:pointer-events-none",
                !isFlipped ? "pointer-events-none" : "z-10"
            )}>
               <div className="flex-grow overflow-y-auto custom-scrollbar pr-4 flex flex-col items-center justify-center">
                    <div className="prose prose-invert prose-lg md:prose-xl opacity-40 text-center mb-8 pb-8 border-b border-gray-600/30 w-full max-w-2xl">
                        <ReactMarkdown>{currentReviewCard.cardFront}</ReactMarkdown>
                    </div>
                    <div className="text-white text-xl md:text-3xl font-medium leading-relaxed md:leading-loose text-center whitespace-pre-wrap max-w-3xl">
                        {currentReviewCard.cardBack}
                    </div>
               </div>
            </div>
        </div>
      </div>

      {/* Controls Area - Fixed at bottom */}
      <div className="mt-6 mb-4 sm:mb-8 flex-shrink-0 w-full max-w-3xl mx-auto min-h-[80px] flex items-center">
        {!isFlipped ? (
          <button 
            onClick={() => setIsFlipped(true)} 
            className="w-full py-5 bg-blue-600 rounded-2xl hover:bg-blue-500 text-white text-xl font-bold shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] transition-all active:scale-95 tracking-wide"
          >
            {t('reviewer.showBackButton')}
          </button>
        ) : (
          <div className="w-full grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <button 
                onClick={() => handleProficiencyUpdate(-10)} 
                className="p-4 bg-red-900/40 border-2 border-red-700/50 text-red-300 rounded-2xl hover:bg-red-600 hover:text-white hover:border-red-500 transition-all flex flex-col items-center justify-center active:scale-95 shadow-sm"
            >
                <span className="font-bold text-sm sm:text-base">{t('reviewer.lowestButton')}</span>
                <span className="text-xs opacity-60 font-mono mt-1">-10</span>
            </button>
            <button 
                onClick={() => handleProficiencyUpdate(-5)} 
                className="p-4 bg-orange-900/40 border-2 border-orange-700/50 text-orange-300 rounded-2xl hover:bg-orange-600 hover:text-white hover:border-orange-500 transition-all flex flex-col items-center justify-center active:scale-95 shadow-sm"
            >
                <span className="font-bold text-sm sm:text-base">{t('reviewer.hardButton')}</span>
                <span className="text-xs opacity-60 font-mono mt-1">-5</span>
            </button>
            <button 
                onClick={() => handleProficiencyUpdate(-1)} 
                className="p-4 bg-yellow-900/40 border-2 border-yellow-700/50 text-yellow-300 rounded-2xl hover:bg-yellow-600 hover:text-white hover:border-yellow-500 transition-all flex flex-col items-center justify-center active:scale-95 shadow-sm"
            >
                <span className="font-bold text-sm sm:text-base">{t('reviewer.okayButton')}</span>
                <span className="text-xs opacity-60 font-mono mt-1">-1</span>
            </button>
            <button 
                onClick={() => handleProficiencyUpdate(1)} 
                className="p-4 bg-teal-900/40 border-2 border-teal-700/50 text-teal-300 rounded-2xl hover:bg-teal-600 hover:text-white hover:border-teal-500 transition-all flex flex-col items-center justify-center active:scale-95 shadow-sm"
            >
                <span className="font-bold text-sm sm:text-base">{t('reviewer.goodButton')}</span>
                <span className="text-xs opacity-60 font-mono mt-1">+1</span>
            </button>
            <button 
                onClick={() => handleProficiencyUpdate(5)} 
                className="p-4 bg-green-900/40 border-2 border-green-700/50 text-green-300 rounded-2xl hover:bg-green-600 hover:text-white hover:border-green-500 transition-all flex flex-col items-center justify-center active:scale-95 shadow-sm"
            >
                <span className="font-bold text-sm sm:text-base">{t('reviewer.easyButton')}</span>
                <span className="text-xs opacity-60 font-mono mt-1">+5</span>
            </button>
            <button 
                onClick={() => handleProficiencyUpdate(10)} 
                className="p-4 bg-sky-900/40 border-2 border-sky-700/50 text-sky-300 rounded-2xl hover:bg-sky-600 hover:text-white hover:border-sky-500 transition-all flex flex-col items-center justify-center active:scale-95 shadow-sm"
            >
                <span className="font-bold text-sm sm:text-base">{t('reviewer.highestButton')}</span>
                <span className="text-xs opacity-60 font-mono mt-1">+10</span>
            </button>
          </div>
        )}
      </div>    </div>
  );
};

export default Reviewer;
