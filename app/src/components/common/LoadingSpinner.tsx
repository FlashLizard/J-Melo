// app/src/components/common/LoadingSpinner.tsx
import React from 'react';
import useTranslation from '@/hooks/useTranslation';

const LoadingSpinner: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="jm-panel flex flex-col items-center p-6 min-w-48">
        <svg
          className="animate-spin h-10 w-10 text-indigo-300"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p className="mt-4 text-gray-200 text-sm font-semibold">{t('home.loadingSongs')}</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
