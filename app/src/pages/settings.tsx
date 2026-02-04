// src/pages/settings.tsx
import React, { useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import useSettingsStore from '@/stores/useSettingsStore';

const SettingsPage = () => {
  const { settings, loadSettings, updateSetting } = useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    // The store now handles saving automatically on change, but we can have an explicit save button if desired.
    // For now, we can just show an alert. In a real app, this might trigger a backend sync.
    alert('Settings are saved automatically as you change them!');
  };

  const handleInputChange = (key: keyof typeof settings, value: string) => {
    updateSetting(key, value);
  };

  const handleSelectChange = (key: keyof typeof settings, value: 'en' | 'zh') => {
    updateSetting(key, value);
  };


  return (
    <>
      <Head>
        <title>Settings - J-Melo</title>
      </Head>
      <main className="bg-gray-900 min-h-screen text-white p-4 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Settings</h1>
            <Link href="/" className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500">
              Back to Player
            </Link>
          </div>

          <div className="space-y-6 bg-gray-800 p-6 rounded-lg">
            <div>
              <label htmlFor="aiLanguage" className="block text-lg font-medium mb-2">
                AI Response Language
              </label>
              <select
                id="aiLanguage"
                value={settings.aiResponseLanguage || 'en'}
                onChange={(e) => handleSelectChange('aiResponseLanguage', e.target.value as 'en' | 'zh')}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="en">English</option>
                <option value="zh">中文</option>
              </select>
            </div>

            <h2 className="text-2xl font-bold mt-8 mb-4 border-b border-gray-700 pb-2">General LLM Settings</h2>

            <div>
              <label htmlFor="apiUrl" className="block text-lg font-medium mb-2">
                LLM API URL
              </label>
              <input
                type="text"
                id="apiUrl"
                value={settings.llmApiUrl || 'https://api.openai.com/v1/chat/completions'}
                onChange={(e) => handleInputChange('llmApiUrl', e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g., https://api.openai.com/v1/chat/completions"
              />
            </div>

            <div>
              <label htmlFor="modelType" className="block text-lg font-medium mb-2">
                Model Type
              </label>
              <input
                type="text"
                id="modelType"
                value={settings.llmModelType || 'gpt-3.5-turbo'}
                onChange={(e) => handleInputChange('llmModelType', e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g., gpt-3.5-turbo, claude-3-opus-20240229"
              />
            </div>
            
            <div>
              <label htmlFor="apiKey" className="block text-lg font-medium mb-2">
                API Key
              </label>
              <input
                type="password"
                id="apiKey"
                value={settings.openaiApiKey || ''}
                onChange={(e) => handleInputChange('openaiApiKey', e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Your API key (e.g., sk-...)"
              />
              <p className="text-xs text-gray-400 mt-2">
                Your API key is stored locally in your browser's IndexedDB.
              </p>
            </div>

            <h2 className="text-2xl font-bold mt-8 mb-4 border-b border-gray-700 pb-2">Lyric Correction LLM Settings</h2>

            <div>
              <label htmlFor="lyricFixApiUrl" className="block text-lg font-medium mb-2">
                Lyric Fix LLM API URL
              </label>
              <input
                type="text"
                id="lyricFixApiUrl"
                value={settings.lyricFixLLMApiUrl || ''}
                onChange={(e) => handleInputChange('lyricFixLLMApiUrl', e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g., https://api.openai.com/v1/chat/completions"
              />
            </div>

            <div>
              <label htmlFor="lyricFixModelType" className="block text-lg font-medium mb-2">
                Lyric Fix LLM Model Type
              </label>
              <input
                type="text"
                id="lyricFixModelType"
                value={settings.lyricFixLLMModelType || ''}
                onChange={(e) => handleInputChange('lyricFixLLMModelType', e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g., gpt-3.5-turbo, claude-3-opus-20240229"
              />
            </div>
            
            <div>
              <label htmlFor="lyricFixApiKey" className="block text-lg font-medium mb-2">
                Lyric Fix API Key
              </label>
              <input
                type="password"
                id="lyricFixApiKey"
                value={settings.lyricFixLLMApiKey || ''}
                onChange={(e) => handleInputChange('lyricFixLLMApiKey', e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Your API key (e.g., sk-...)"
              />
              <p className="text-xs text-gray-400 mt-2">
                If left empty, the general API Key will be used.
              </p>
            </div>

            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 w-full"
            >
              Save Settings (Auto-saves on change)
            </button>
          </div>
        </div>
      </main>
    </>
  );
};

export default SettingsPage;