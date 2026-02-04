// src/pages/settings.tsx
import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useSettingsStore from '@/stores/useSettingsStore';
import useTranslation from '@/hooks/useTranslation'; // Import useTranslation hook

const SettingsPage: React.FC = () => {
  const { settings, updateSetting, loadSettings } = useSettingsStore();
  const { t } = useTranslation(); // Use the translation hook
  const router = useRouter();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    updateSetting(name as keyof typeof settings, value);
  };

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-white">{t('settings.title')}</h1>
            <Link href="/" className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-white">
                {t('settings.backToPlayer')}
            </Link>
        </header>

        <div className="space-y-8">
            {/* Interface Language Section */}
            <div className="bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold border-b border-gray-700 pb-3 mb-4">{t('settings.interfaceLanguage')}</h2>
                <div>
                  <label htmlFor="uiLanguage" className="block text-sm font-medium text-gray-300">{t('settings.interfaceLanguage')}</label>
                  <select name="uiLanguage" id="uiLanguage" value={settings.uiLanguage || 'en'} onChange={handleInputChange} className="mt-1 block w-full p-2 rounded bg-gray-700 border border-gray-600">
                    <option value="en">{t('language.english')}</option>
                    <option value="zh">{t('language.chinese')}</option>
                  </select>
                </div>
            </div>

            {/* Cache Management Section */}
            <div className="bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold border-b border-gray-700 pb-3 mb-4">{t('settings.cacheSectionTitle')}</h2>
                <div className="flex justify-between items-center">
                    <p className="text-gray-300">{t('settings.cacheDescription')}</p>
                    <button
                        onClick={() => router.push('/settings/cache')}
                        className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 text-white"
                    >
                        {t('settings.manageCacheButton')}
                    </button>
                </div>
            </div>

            {/* LLM API Section */}
            <div className="bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold border-b border-gray-700 pb-3 mb-4">{t('settings.llmApiSectionTitle')}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">{t('settings.llmReplyLanguage')}</label>
                  <select name="aiResponseLanguage" value={settings.aiResponseLanguage || 'en'} onChange={handleInputChange} className="mt-1 block w-full p-2 rounded bg-gray-700 border border-gray-600">
                    <option value="en">{t('language.english')}</option>
                    <option value="zh">{t('language.chinese')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">{t('settings.apiKey')}</label>
                  <input type="password" name="openaiApiKey" value={settings.openaiApiKey || ''} onChange={handleInputChange} className="mt-1 block w-full p-2 rounded bg-gray-700 border border-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">{t('settings.llmApiUrl')}</label>
                  <input type="text" name="llmApiUrl" value={settings.llmApiUrl || ''} onChange={handleInputChange} placeholder="e.g., https://api.openai.com/v1/chat/completions" className="mt-1 block w-full p-2 rounded bg-gray-700 border border-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">{t('settings.llmModelType')}</label>
                  <input type="text" name="llmModelType" value={settings.llmModelType || ''} onChange={handleInputChange} placeholder="e.g., gpt-3.5-turbo" className="mt-1 block w-full p-2 rounded bg-gray-700 border border-gray-600" />
                </div>
              </div>
            </div>
            
            {/* Lyric Fixer LLM API Section */}
            <div className="bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold border-b border-gray-700 pb-3 mb-4">{t('settings.lyricFixLlmSectionTitle')}</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300">{t('settings.apiKey')}</label>
                        <input type="password" name="lyricFixLLMApiKey" value={settings.lyricFixLLMApiKey || ''} onChange={handleInputChange} className="mt-1 block w-full p-2 rounded bg-gray-700 border border-gray-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">{t('settings.llmApiUrl')}</label>
                        <input type="text" name="lyricFixLLMApiUrl" value={settings.lyricFixLLMApiUrl || ''} onChange={handleInputChange} className="mt-1 block w-full p-2 rounded bg-gray-700 border border-gray-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">{t('settings.llmModelType')}</label>
                        <input type="text" name="lyricFixLLMModelType" value={settings.lyricFixLLMModelType || ''} onChange={handleInputChange} className="mt-1 block w-full p-2 rounded bg-gray-700 border border-gray-600" />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{t('settings.lyricFixApiKeyHint')}</p>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsPage;