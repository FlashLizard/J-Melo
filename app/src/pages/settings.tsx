// src/pages/settings.tsx
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useSettingsStore from '@/stores/useSettingsStore';
import useTranslation from '@/hooks/useTranslation'; // Import useTranslation hook
import { exportAllData, importAllData, blobToBase64 } from '@/lib/db';
import { copyToClipboard } from '@/utils/copyToClipboard';

const SettingsPage: React.FC = () => {
  const { settings, updateSetting, loadSettings } = useSettingsStore();
  const { t } = useTranslation(); // Use the translation hook
  const router = useRouter();

  const [exportToken, setExportToken] = useState(null);
  const [importToken, setImportToken] = useState('');
  const [importMode, setImportMode] = useState('merge');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    updateSetting(name as keyof typeof settings, value);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportToken(null);
    try {
      const data = await exportAllData();
      
      // Convert coverImageData to Base64
      const sanitizedSongs = await Promise.all(data.songs.map(async (song) => {
        const { coverImageData, ...rest } = song;
        let coverImageBase64 = '';
        if (coverImageData instanceof Blob) {
          coverImageBase64 = await blobToBase64(coverImageData);
        }
        return { ...rest, coverImageData: coverImageBase64 };
      }));

      const response = await fetch(`${settings.backendUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, songs: sanitizedSongs }),
      });
      if (!response.ok) throw new Error('Failed to export data.');
      const result = await response.json();
      setExportToken(result);
    } catch (error) {
      alert('Error exporting data: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importToken.trim()) {
      alert('Please enter a token.');
      return;
    }
    setIsImporting(true);
    try {
      const response = await fetch(`${settings.backendUrl}/api/import?token=${importToken}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to import data.');
      }
      const data = await response.json();
      await importAllData(data, importMode);
      alert('Import successful! The application will now reload.');
      window.location.reload();
    } catch (error) {
      alert('Error importing data: ' + error.message);
    } finally {
      setIsImporting(false);
    }
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

            {/* Backend Settings Section */}
            <div className="bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold border-b border-gray-700 pb-3 mb-4">{t('settings.backendSettingsTitle')}</h2>
                <div>
                    <label htmlFor="backendUrl" className="block text-sm font-medium text-gray-300">{t('settings.backendUrlLabel')}</label>
                    <input
                        type="text"
                        id="backendUrl"
                        name="backendUrl"
                        value={settings.backendUrl || ''}
                        onChange={handleInputChange}
                        placeholder="e.g., http://localhost:8000"
                        className="mt-1 block w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>
            </div>

            {/* Data Backup & Restore Section */}
            <div className="bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold border-b border-gray-700 pb-3 mb-4">{t('settings.dataBackupRestoreTitle')}</h2>
                <div className="space-y-6">
                    {/* Export */}
                    <div>
                        <h3 className="text-lg font-medium mb-2">{t('settings.exportDataTitle')}</h3>
                        <p className="text-sm text-gray-400 mb-4">{t('settings.exportDescription')}</p>
                        <button onClick={handleExport} disabled={isExporting} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 text-white disabled:opacity-50">
                            {isExporting ? t('settings.exportingButton') : t('settings.exportButton')}
                        </button>
                        {exportToken && (
                            <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm text-gray-300">{t('settings.exportTokenMessage')}</p>
                                        <code className="block break-all bg-gray-900 p-2 rounded my-2">{exportToken.token}</code>
                                        <p className="text-xs text-gray-400">{t('settings.tokenExpiresAt', { time: new Date(exportToken.expires_at).toLocaleString() })}</p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            copyToClipboard(exportToken.token).then(() => {
                                                alert(t('settings.tokenCopied'));
                                            }).catch(err => {
                                                console.error('Failed to copy token: ', err);
                                                alert('Failed to copy token.');
                                            });
                                        }}
                                        className="p-2 ml-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                                        title={t('settings.copyButton')}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M7 3a1 1 0 011-1h3a1 1 0 011 1v1h1a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h1V3z" />
                                            <path d="M9 2a2 2 0 00-2 2v1h4V4a2 2 0 00-2-2z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Import */}
                    <div>
                        <h3 className="text-lg font-medium mb-2">{t('settings.importDataTitle')}</h3>
                        <p className="text-sm text-gray-400 mb-2">{t('settings.importDescription')}</p>
                        <input type="text" value={importToken} onChange={(e) => setImportToken(e.target.value)} placeholder={t('settings.importTokenPlaceholder')} className="block w-full p-2 rounded bg-gray-700 border border-gray-600 mb-4" />
                        <div className="flex items-center space-x-4 mb-4">
                            <label className="inline-flex items-center">
                                <input type="radio" name="importMode" value="merge" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} className="form-radio text-green-500" />
                                <span className="ml-2">{t('settings.importModeMerge')}</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input type="radio" name="importMode" value="overwrite" checked={importMode === 'overwrite'} onChange={() => setImportMode('overwrite')} className="form-radio text-green-500" />
                                <span className="ml-2">{t('settings.importModeOverwrite')}</span>
                            </label>
                        </div>
                        <button onClick={handleImport} disabled={isImporting} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 text-white disabled:opacity-50">
                            {isImporting ? t('settings.importingButton') : t('settings.importButton')}
                        </button>
                    </div>
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

            {/* Translation LLM API Section */}
            <div className="bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold border-b border-gray-700 pb-3 mb-4">{t('settings.translationLlmSectionTitle')}</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300">{t('settings.targetTranslationLanguage')}</label>
                        <select name="targetTranslationLanguage" value={settings.targetTranslationLanguage || 'en'} onChange={handleInputChange} className="mt-1 block w-full p-2 rounded bg-gray-700 border border-gray-600">
                            <option value="en">{t('language.english')}</option>
                            <option value="zh">{t('language.chinese')}</option>
                            <option value="ja">{t('language.japanese')}</option>
                            <option value="ko">{t('language.korean')}</option>
                            <option value="fr">{t('language.french')}</option>
                            <option value="de">{t('language.german')}</option>
                            <option value="es">{t('language.spanish')}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">{t('settings.apiKey')}</label>
                        <input type="password" name="translationLLMApiKey" value={settings.translationLLMApiKey || ''} onChange={handleInputChange} className="mt-1 block w-full p-2 rounded bg-gray-700 border border-gray-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">{t('settings.llmApiUrl')}</label>
                        <input type="text" name="translationLLMApiUrl" value={settings.translationLLMApiUrl || ''} onChange={handleInputChange} className="mt-1 block w-full p-2 rounded bg-gray-700 border border-gray-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">{t('settings.llmModelType')}</label>
                        <input type="text" name="translationLLMModelType" value={settings.translationLLMModelType || ''} onChange={handleInputChange} className="mt-1 block w-full p-2 rounded bg-gray-700 border border-gray-600" />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{t('settings.lyricTranslationApiKeyHint')}</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;