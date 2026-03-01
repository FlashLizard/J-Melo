import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useTranslation from '@/hooks/useTranslation';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[200] p-4" onClick={onClose}>      <div 
        className="bg-gray-800 text-white rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
          <h2 className="text-2xl font-bold text-green-400">{t('about.title')}</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-700 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-grow overflow-y-auto space-y-4 text-sm text-gray-200 leading-relaxed pr-2">
          <p className="text-base">{t('about.intro')}</p>
          
          <div className="bg-yellow-900/30 border border-yellow-700 p-3 rounded-lg flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <p className="font-semibold text-yellow-300 mt-0.5">{t('about.ai_written')}</p>
          </div>
          
          <h3 className="text-lg font-bold text-white mt-6 mb-2 border-b border-gray-700 pb-1 inline-block">
            {t('about.features_title')}
          </h3>
          
          <ul className="space-y-4">
            <li className="flex gap-3">
                <span className="text-green-400 font-bold">▶</span>
                <div>
                    <strong className="text-white block mb-1">{t('about.feat_player_title')}</strong> 
                    <span className="text-gray-400">{t('about.feat_player_desc')}</span>
                </div>
            </li>
            <li className="flex gap-3">
                <span className="text-blue-400 font-bold">✎</span>
                <div>
                    <strong className="text-white block mb-1">{t('about.feat_lyrics_title')}</strong> 
                    <span className="text-gray-400">{t('about.feat_lyrics_desc')}</span>
                </div>
            </li>
            <li className="flex gap-3">
                <span className="text-purple-400 font-bold">🧠</span>
                <div>
                    <strong className="text-white block mb-1">{t('about.feat_tutor_title')}</strong> 
                    <span className="text-gray-400">{t('about.feat_tutor_desc')}</span>
                </div>
            </li>
            <li className="flex gap-3">
                <span className="text-orange-400 font-bold">🌍</span>
                <div>
                    <strong className="text-white block mb-1">{t('about.feat_community_title')}</strong> 
                    <span className="text-gray-400">{t('about.feat_community_desc')}</span>
                </div>
            </li>
          </ul>

          <div className="mt-8 pt-6 border-t border-gray-700 text-center">
             <p className="mb-3 text-gray-300">{t('about.github_prompt')}</p>
             <a 
                href="https://github.com/FlashLizard/J-Melo" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-mono text-sm border border-gray-600 hover:border-gray-400"
             >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                FlashLizard/J-Melo
             </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AboutModal;