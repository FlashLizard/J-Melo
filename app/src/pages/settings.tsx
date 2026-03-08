// src/pages/settings.tsx
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/head';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import useSettingsStore from '@/stores/useSettingsStore';
import useTranslation from '@/hooks/useTranslation';
import { exportAllData, importAllData, blobToBase64 } from '@/lib/db';
import { copyToClipboard } from '@/utils/copyToClipboard';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';
import Head from 'next/head';

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-gray-800/40 backdrop-blur-sm rounded-3xl border border-gray-700/50 p-6 sm:p-8 shadow-lg">
      <h2 className="text-lg font-bold text-gray-200 uppercase tracking-wider mb-6 flex items-center gap-3">
          <span className="text-indigo-400">{icon}</span>
          {title}
      </h2>
      {children}
  </div>
);

const InputField: React.FC<{ 
  label: string; 
  name: string; 
  type?: string; 
  placeholder?: string; 
  value: any; 
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void 
}> = ({ label, name, type = 'text', placeholder, value, onChange }) => (
  <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-400 mb-2 ml-1">{label}</label>
      <input
          type={type}
          id={name}
          name={name}
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full p-3 rounded-2xl bg-gray-900/50 border border-gray-700/50 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-600 shadow-inner"
      />
  </div>
);

const SettingsPage: React.FC = () => {
  const { settings, updateSetting, loadSettings } = useSettingsStore();
  const { t } = useTranslation();
  const router = useRouter();

  const [exportToken, setExportToken] = useState<any>(null);
  const [importToken, setImportToken] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const finalValue = type === 'number' ? (value ? Number(value) : undefined) : value;
    updateSetting(name as keyof typeof settings, finalValue);
  };

  const handleExportAsToken = async () => {
    setIsExporting(true);
    setExportToken(null);
    try {
      const data = await exportAllData();
      
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
      toast.success(t('settings.exportSuccess'));
    } catch (error) {
      toast.error('Error exporting token: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAsJson = async () => {
    setIsExporting(true);
    try {
        const data = await exportAllData();
        const sanitizedSongs = await Promise.all(data.songs.map(async (song) => {
            const { coverImageData, ...rest } = song;
            let coverImageBase64 = '';
            if (coverImageData instanceof Blob) {
                coverImageBase64 = await blobToBase64(coverImageData);
            }
            return { ...rest, coverImageData: coverImageBase64 };
        }));

        const finalData = { ...data, songs: sanitizedSongs };
        const blob = new Blob([JSON.stringify(finalData, null, 2)], { type: 'application/json' });
        saveAs(blob, `j-melo-backup-${new Date().toISOString().split('T')[0]}.json`);
        toast.success(t('settings.exportSuccess'));
    } catch (error) {
        toast.error('Error exporting JSON: ' + (error as Error).message);
    } finally {
        setIsExporting(false);
    }
  };

  const handleImportByToken = async () => {
    if (!importToken.trim()) {
      toast.error('Please enter a token.');
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
      toast.success(t('settings.importSuccess'));
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error('Error importing by token: ' + (error as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        setIsImporting(true);
        try {
            const data = JSON.parse(event.target?.result as string);
            await importAllData(data, importMode);
            toast.success(t('settings.importSuccess'));
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            toast.error('Error parsing JSON file: ' + (error as Error).message);
        } finally {
            setIsImporting(false);
        }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Head>
        <title>{`J-Melo - ${t('settings.title')}`}</title>
      </Head>
      <main className="bg-[#0f172a] min-h-screen text-white pb-12 selection:bg-indigo-500/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
          
          {/* Header */}
          <header className="relative z-[100] flex flex-row justify-between items-center gap-2 sm:gap-6 mb-8 bg-gray-800/40 p-3 sm:p-5 rounded-[2rem] border border-gray-700/50 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                  <div className="bg-gray-900/50 p-1.5 sm:p-2.5 rounded-2xl shadow-inner border border-gray-700/50 flex-shrink-0">
                      <img src="/logo.svg" alt="J-Melo Logo" className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow-md" />
                  </div>
                  <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent truncate">{t('settings.title')}</h1>
              </div>
              <NextLink href="/" className="p-2 sm:p-2.5 bg-gray-700/80 text-gray-200 rounded-2xl hover:bg-gray-600 hover:text-white transition-all flex items-center justify-center border border-gray-600/50 shadow-sm flex-shrink-0" title={t('settings.backToPlayer')}>
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
              </NextLink>
          </header>

          <div className="space-y-6">
              <SectionCard title={t('settings.interfaceLanguage')} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
                    <div>
                        <label htmlFor="uiLanguage" className="block text-sm font-medium text-gray-400 mb-2 ml-1">{t('settings.interfaceLanguage')}</label>
                        <select name="uiLanguage" id="uiLanguage" value={settings.uiLanguage || 'en'} onChange={handleInputChange} className="w-full p-3 rounded-2xl bg-gray-900/50 border border-gray-700/50 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-inner">
                            <option value="en">{t('language.english')}</option>
                            <option value="zh">{t('language.chinese')}</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="themeMode" className="block text-sm font-medium text-gray-400 mb-2 ml-1">{t('settings.themeMode')}</label>
                        <select name="themeMode" id="themeMode" value={settings.themeMode || 'dark'} onChange={handleInputChange} className="w-full p-3 rounded-2xl bg-gray-900/50 border border-gray-700/50 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-inner">
                            <option value="dark">{t('settings.themeDark')}</option>
                            <option value="light">{t('settings.themeLight')}</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="defaultHomepage" className="block text-sm font-medium text-gray-400 mb-2 ml-1">{t('settings.defaultHomepage')}</label>
                        <select name="defaultHomepage" id="defaultHomepage" value={settings.defaultHomepage || 'library'} onChange={handleInputChange} className="w-full p-3 rounded-2xl bg-gray-900/50 border border-gray-700/50 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-inner">
                            <option value="library">{t('home.title')}</option>
                            <option value="player">Player</option>
                        </select>
                    </div>
                  </div>
              </SectionCard>

              <SectionCard title={t('settings.dataBackupRestoreTitle')} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>}>
                  <div className="space-y-10">
                      {/* Export Section */}
                      <div>
                          <h3 className="text-base font-bold text-gray-300 mb-2 uppercase tracking-wide">{t('settings.exportDataTitle')}</h3>
                          <p className="text-sm text-gray-500 mb-6">{t('settings.exportDescription')}</p>
                          <div className="flex flex-wrap gap-4">
                              <button onClick={handleExportAsToken} disabled={isExporting} className="px-6 py-2.5 bg-emerald-600/90 rounded-xl hover:bg-emerald-500 text-white font-bold transition-all disabled:opacity-50 shadow-md border border-emerald-500/30 flex items-center gap-2">
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                                  {t('settings.exportAsToken')}
                              </button>
                              <button onClick={handleExportAsJson} disabled={isExporting} className="px-6 py-2.5 bg-indigo-600/90 rounded-xl hover:bg-indigo-500 text-white font-bold transition-all disabled:opacity-50 shadow-md border border-indigo-500/30 flex items-center gap-2">
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  {t('settings.exportAsJson')}
                              </button>
                          </div>
                          
                          {exportToken && (
                              <div className="mt-6 p-4 bg-gray-900/60 rounded-2xl border border-gray-700/50 shadow-inner animate-in fade-in slide-in-from-top-2">
                                  <div className="flex justify-between items-start gap-4">
                                      <div className="min-w-0">
                                          <p className="text-sm text-indigo-300 font-medium mb-2">{t('settings.exportTokenMessage')}</p>
                                          <code className="block break-all bg-black/40 p-3 rounded-xl my-2 text-indigo-200 border border-indigo-500/20 font-mono text-sm">{exportToken.token}</code>
                                          <p className="text-xs text-gray-500">{t('settings.tokenExpiresAt', { time: new Date(exportToken.expires_at).toLocaleString() })}</p>
                                      </div>
                                      <button 
                                          onClick={() => {
                                              copyToClipboard(exportToken.token).then(() => {
                                                  toast.success(t('settings.tokenCopied') || 'Copied!');
                                              }).catch(err => {
                                                  toast.error('Failed to copy token.');
                                              });
                                          }}
                                          className="p-3 bg-gray-800 rounded-xl hover:bg-gray-700 text-gray-300 transition-colors flex-shrink-0 shadow-sm"
                                          title={t('settings.copyButton')}
                                      >
                                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>

                      {/* Import Section */}
                      <div className="pt-8 border-t border-gray-700/30">
                          <h3 className="text-base font-bold text-gray-300 mb-2 uppercase tracking-wide">{t('settings.importDataTitle')}</h3>
                          <p className="text-sm text-gray-500 mb-6">{t('settings.importDescription')}</p>
                          
                          <div className="flex flex-wrap items-center gap-6 mb-8">
                              <label className="inline-flex items-center group cursor-pointer">
                                  <input type="radio" name="importMode" value="merge" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} className="form-radio h-5 w-5 text-indigo-500 bg-gray-900 border-gray-700" />
                                  <span className="ml-3 text-sm text-gray-300 group-hover:text-white transition-colors">{t('settings.importModeMerge')}</span>
                              </label>
                              <label className="inline-flex items-center group cursor-pointer">
                                  <input type="radio" name="importMode" value="overwrite" checked={importMode === 'overwrite'} onChange={() => setImportMode('overwrite')} className="form-radio h-5 w-5 text-indigo-500 bg-gray-900 border-gray-700" />
                                  <span className="ml-3 text-sm text-gray-300 group-hover:text-white transition-colors">{t('settings.importModeOverwrite')}</span>
                              </label>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-4">
                                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">{t('settings.importByToken')}</label>
                                  <div className="flex gap-2">
                                      <input type="text" value={importToken} onChange={(e) => setImportToken(e.target.value)} placeholder={t('settings.importTokenPlaceholder')} className="flex-grow p-3 rounded-xl bg-gray-900/50 border border-gray-700/50 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-600 shadow-inner" />
                                      <button onClick={handleImportByToken} disabled={isImporting || !importToken.trim()} className="px-5 py-3 bg-indigo-600 rounded-xl hover:bg-indigo-500 text-white font-bold transition-all disabled:opacity-50 shrink-0">
                                          {isImporting ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> : t('settings.importButton')}
                                      </button>
                                  </div>
                              </div>

                              <div className="space-y-4">
                                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">{t('settings.importByJson')}</label>
                                  <input 
                                      type="file" 
                                      ref={fileInputRef} 
                                      onChange={handleFileImport} 
                                      accept=".json" 
                                      className="hidden" 
                                  />
                                  <button 
                                      onClick={() => fileInputRef.current?.click()} 
                                      disabled={isImporting} 
                                      className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold rounded-xl transition-all border border-gray-600/50 flex items-center justify-center gap-2"
                                  >
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                      {t('settings.selectJsonFile')}
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              </SectionCard>

              <SectionCard title={t('settings.cacheSectionTitle')} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <p className="text-sm text-gray-500 max-w-md">{t('settings.cacheDescription')}</p>
                      <button onClick={() => router.push('/settings/cache')} className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-xl transition-all border border-gray-600/50 shadow-sm w-full sm:w-auto">
                          {t('settings.manageCacheButton')}
                      </button>
                  </div>
              </SectionCard>

              <SectionCard title={t('settings.adminSectionTitle')} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <p className="text-sm text-gray-500 max-w-md">{t('settings.adminDescription')}</p>
                      <button onClick={() => router.push('/settings/admin')} className="px-5 py-2.5 bg-indigo-900/40 text-indigo-300 border border-indigo-800/50 hover:bg-indigo-800 hover:text-white rounded-xl transition-all text-sm font-bold shadow-sm w-full sm:w-auto">
                          {t('settings.adminButton')}
                      </button>
                  </div>
              </SectionCard>

              <SectionCard title={t('settings.llmApiSectionTitle')} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}>
                  <div className="space-y-6">
                      <div className="max-w-md">
                          <label htmlFor="aiResponseLanguage" className="block text-sm font-medium text-gray-400 mb-2 ml-1">{t('settings.llmReplyLanguage')}</label>
                          <select name="aiResponseLanguage" id="aiResponseLanguage" value={settings.aiResponseLanguage || 'en'} onChange={handleInputChange} className="w-full p-3 rounded-2xl bg-gray-900/50 border border-gray-700/50 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-inner">
                              <option value="en">{t('language.english')}</option>
                              <option value="zh">{t('language.chinese')}</option>
                          </select>
                      </div>
                      <InputField label={t('settings.apiKey')} name="openaiApiKey" type="password" value={settings.openaiApiKey} onChange={handleInputChange} />
                      <InputField label={t('settings.llmApiUrl')} name="llmApiUrl" value={settings.llmApiUrl} placeholder="e.g., https://api.openai.com/v1/chat/completions" onChange={handleInputChange} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <InputField label={t('settings.llmModelType')} name="llmModelType" value={settings.llmModelType} placeholder="e.g., gpt-3.5-turbo" onChange={handleInputChange} />
                          <InputField label={t('settings.llmMaxTokens')} name="llmMaxTokens" type="number" value={settings.llmMaxTokens} placeholder="e.g., 32768" onChange={handleInputChange} />
                      </div>
                  </div>
              </SectionCard>

              <SectionCard title={t('settings.lyricFixLlmSectionTitle')} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}>
                  <div className="space-y-6">
                      <InputField label={t('settings.apiKey')} name="lyricFixLLMApiKey" type="password" value={settings.lyricFixLLMApiKey} onChange={handleInputChange} />
                      <InputField label={t('settings.llmApiUrl')} name="lyricFixLLMApiUrl" value={settings.lyricFixLLMApiUrl} onChange={handleInputChange} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <InputField label={t('settings.llmModelType')} name="lyricFixLLMModelType" value={settings.lyricFixLLMModelType} onChange={handleInputChange} />
                          <InputField label={t('settings.llmMaxTokens')} name="lyricFixLLMMaxTokens" type="number" value={settings.lyricFixLLMMaxTokens} onChange={handleInputChange} />
                      </div>
                      <p className="text-xs text-gray-500 ml-1 italic">{t('settings.lyricFixApiKeyHint')}</p>
                  </div>
              </SectionCard>

              <SectionCard title={t('settings.translationLlmSectionTitle')} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>}>
                  <div className="space-y-6">
                      <div className="max-w-md">
                          <label htmlFor="targetTranslationLanguage" className="block text-sm font-medium text-gray-400 mb-2 ml-1">{t('settings.targetTranslationLanguage')}</label>
                          <select name="targetTranslationLanguage" id="targetTranslationLanguage" value={settings.targetTranslationLanguage || 'en'} onChange={handleInputChange} className="w-full p-3 rounded-2xl bg-gray-900/50 border border-gray-700/50 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-inner">
                              <option value="en">{t('language.english')}</option>
                              <option value="zh">{t('language.chinese')}</option>
                              <option value="ja">{t('language.japanese')}</option>
                              <option value="ko">{t('language.korean')}</option>
                              <option value="fr">{t('language.french')}</option>
                              <option value="de">{t('language.german')}</option>
                              <option value="es">{t('language.spanish')}</option>
                          </select>
                      </div>
                      <InputField label={t('settings.apiKey')} name="translationLLMApiKey" type="password" value={settings.translationLLMApiKey} onChange={handleInputChange} />
                      <InputField label={t('settings.llmApiUrl')} name="translationLLMApiUrl" value={settings.translationLLMApiUrl} onChange={handleInputChange} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <InputField label={t('settings.llmModelType')} name="translationLLMModelType" value={settings.translationLLMModelType} onChange={handleInputChange} />
                          <InputField label={t('settings.llmMaxTokens')} name="translationLLMMaxTokens" type="number" value={settings.translationLLMMaxTokens} onChange={handleInputChange} />
                      </div>
                      <p className="text-xs text-gray-500 ml-1 italic">{t('settings.lyricTranslationApiKeyHint')}</p>
                  </div>
              </SectionCard>
          </div>
        </div>
      </main>
    </>
  );
};

export default SettingsPage;
