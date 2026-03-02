// src/pages/settings/admin.tsx
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import useTranslation from '@/hooks/useTranslation';
import { filesize } from 'filesize';
import { db } from '@/lib/db';
import Head from 'next/head';
import cn from 'classnames';

interface CacheInfo {
  size_bytes: number;
  file_count?: number;
}

interface ServerCacheInfo {
  media: CacheInfo;
  transcription: CacheInfo;
  tokens: CacheInfo;
  community: {
    db_size_bytes: number;
    song_count: number;
    quota_bytes: number;
  };
}

interface CleanupPolicy {
  max_size_gb: number;
  max_age_days: number;
}

interface ServerPolicies {
  media: CleanupPolicy;
  transcription: CleanupPolicy;
  tokens: CleanupPolicy;
  proxy: string | null;
  admin_token: string;
}

interface TaskStatus {
    url: string;
    status: string;
    queue_position: number;
    created_at: string;
}

const SectionCard: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-gray-800/40 backdrop-blur-sm rounded-3xl border border-gray-700/50 p-6 sm:p-8 shadow-lg">
      <h2 className="text-xl font-bold text-gray-200 uppercase tracking-wider mb-6 flex items-center gap-3">
          {icon && <span className="text-indigo-400">{icon}</span>}
          {title}
      </h2>
      {children}
  </div>
);

const AdminPage = () => {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<ServerCacheInfo | null>(null);
  const [policies, setPolicies] = useState<ServerPolicies | null>(null);
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState('');

  useEffect(() => {
    const loadBackendUrl = async () => {
      const settings = await db.settings.get(0);
      setBackendUrl(settings?.backendUrl || 'http://localhost:8000');
    };
    loadBackendUrl();
  }, []);

  const fetchAdminData = async (authToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = { 'Authorization': `Bearer ${authToken}` };
      
      const [cacheRes, configRes, tasksRes] = await Promise.all([
        fetch(`${backendUrl}/api/admin/cache-info`, { headers }),
        fetch(`${backendUrl}/api/admin/config`, { headers }),
        fetch(`${backendUrl}/api/admin/transcription-tasks`, { headers })
      ]);

      if (!cacheRes.ok || !configRes.ok || !tasksRes.ok) {
        if (cacheRes.status === 401) throw new Error(t('admin.invalidToken'));
        throw new Error(t('admin.fetchError'));
      }

      const cacheData = await cacheRes.json();
      const configData = await configRes.json();
      const tasksData = await tasksRes.json();

      // Map backend data to frontend structure
      setCacheInfo({
          media: cacheData.media_cache,
          tokens: cacheData.token_cache,
          transcription: cacheData.transcription_cache,
          community: {
              db_size_bytes: cacheData.community_db.size_bytes,
              song_count: 0, // Not provided by this endpoint currently
              quota_bytes: configData.community_policy?.max_db_size_bytes || 1024 * 1024 * 1024
          }
      });

      setPolicies({
          media: configData.media_cache_policy,
          tokens: configData.token_cache_policy,
          transcription: configData.transcription_cache_policy,
          proxy: configData.proxy,
          admin_token: configData.admin_token
      });

      // Transform tasks map to array
      const tasksList: TaskStatus[] = Object.entries(tasksData).map(([id, info]: [string, any]) => ({
          url: info.display_name || id,
          status: info.status,
          queue_position: 0,
          created_at: info.started_at || new Date().toISOString()
      }));
      setTasks(tasksList);

      setIsAuthenticated(true);
      sessionStorage.setItem('admin_token', authToken);
    } catch (err) {
      setError((err as Error).message);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedToken = sessionStorage.getItem('admin_token');
    if (savedToken && backendUrl) {
      fetchAdminData(savedToken);
    }
  }, [backendUrl]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    fetchAdminData(token);
  };

  const handleLogout = () => {
      setIsAuthenticated(false);
      sessionStorage.removeItem('admin_token');
      setToken('');
  };

  const handleClearCache = async (cacheName: string) => {
    // Map frontend names to backend names if necessary
    const backendCacheName = cacheName === 'transcription' ? 'transcriptions' : cacheName;
    if (!window.confirm(t('admin.confirmClear', { cacheName }))) return;
    
    setIsLoading(true);
    try {
      const authToken = sessionStorage.getItem('admin_token');
      const res = await fetch(`${backendUrl}/api/admin/clear-cache`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cache_name: backendCacheName })
      });
      if (!res.ok) throw new Error(t('admin.clearError'));
      alert(t('admin.clearSuccess', { cacheName }));
      fetchAdminData(authToken!);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!policies) return;
    setIsSaving(true);
    try {
      const authToken = sessionStorage.getItem('admin_token');
      const payload = {
          admin_token: policies.admin_token,
          proxy: policies.proxy,
          media_cache_policy: policies.media,
          token_cache_policy: policies.tokens,
          transcription_cache_policy: policies.transcription
      };
      const res = await fetch(`${backendUrl}/api/admin/config`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(t('admin.saveConfigError'));
      alert(t('admin.saveConfigSuccess'));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!backendUrl) return null;

  return (
    <>
      <Head>
        <title>{`J-Melo - ${t('admin.title')}`}</title>
      </Head>
      <div className="bg-[#0f172a] min-h-screen text-white pb-12 selection:bg-indigo-500/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
          <header className="relative z-[100] flex flex-row justify-between items-center gap-2 sm:gap-6 mb-8 bg-gray-800/40 p-3 sm:p-5 rounded-[2rem] border border-gray-700/50 shadow-lg backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <div className="bg-gray-900/50 p-1.5 sm:p-2.5 rounded-2xl shadow-inner border border-gray-700/50 flex-shrink-0">
                    <img src="/logo.svg" alt="J-Melo Logo" className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow-md" />
                </div>
                <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent truncate">{t('admin.title')}</h1>
            </div>
            <Link href="/settings" className="p-2 sm:p-2.5 bg-gray-700/80 text-gray-200 rounded-xl hover:bg-gray-600 hover:text-white transition-all flex items-center justify-center border border-gray-600/50 shadow-sm flex-shrink-0" title={t('admin.backToSettings')}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
            </Link>
          </header>

          {error && (
            <div className="bg-red-900/40 border border-red-800 p-4 rounded-2xl mb-8 text-center text-red-200 shadow-sm">
              <p>{error}</p>
            </div>
          )}

          {!isAuthenticated ? (
            <SectionCard title={t('admin.authTitle')} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}>
              <p className="text-gray-400 mb-6">{t('admin.authDescription')}</p>
              <form onSubmit={handleLogin} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t('admin.tokenPlaceholder')}
                  className="flex-grow p-3 rounded-xl bg-gray-900/50 border border-gray-700/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                />
                <button type="submit" className="px-8 py-3 bg-indigo-600 rounded-xl hover:bg-indigo-500 font-bold transition-all shadow-md shadow-indigo-900/20 active:scale-95">{t('admin.loginButton')}</button>
              </form>
            </SectionCard>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
              {(isLoading && !cacheInfo) ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <svg className="animate-spin h-10 w-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <p className="text-gray-400 font-medium animate-pulse">{t('admin.loadingInfo')}</p>
                  </div>
              ) : cacheInfo && policies && (
                <>
                  <SectionCard title={t('admin.generalSettingsTitle')} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">{t('admin.proxyLabel')}</label>
                        <input
                          type="text"
                          value={policies.proxy || ''}
                          onChange={(e) => setPolicies({ ...policies, proxy: e.target.value })}
                          placeholder="e.g., http://127.0.0.1:7890"
                          className="w-full p-3 rounded-xl bg-gray-900/50 border border-gray-700/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">{t('admin.adminTokenLabel')}</label>
                        <input
                          type="password"
                          value={policies.admin_token}
                          onChange={(e) => setPolicies({ ...policies, admin_token: e.target.value })}
                          className="w-full p-3 rounded-xl bg-gray-900/50 border border-gray-700/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                        />
                      </div>
                    </div>
                  </SectionCard>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <CacheCard 
                        title={t('admin.mediaCacheTitle')} 
                        info={cacheInfo.media} 
                        policy={policies.media} 
                        onPolicyChange={(p) => setPolicies({...policies, media: p})}
                        onClear={() => handleClearCache('media')}
                        t={t}
                    />
                    <CacheCard 
                        title={t('admin.transcriptionCacheTitle')} 
                        info={cacheInfo.transcription} 
                        policy={policies.transcription} 
                        onPolicyChange={(p) => setPolicies({...policies, transcription: p})}
                        onClear={() => handleClearCache('transcription')}
                        t={t}
                    />
                    <CacheCard 
                        title={t('admin.tokenCacheTitle')} 
                        info={cacheInfo.tokens} 
                        policy={policies.tokens} 
                        onPolicyChange={(p) => setPolicies({...policies, tokens: p})}
                        onClear={() => handleClearCache('tokens')}
                        t={t}
                    />
                    
                    <div className="bg-gray-800/40 backdrop-blur-sm rounded-3xl border border-gray-700/50 p-6 sm:p-8 shadow-lg flex flex-col">
                        <h2 className="text-xl font-bold text-gray-200 uppercase tracking-wider mb-6 flex items-center gap-3">
                            <span className="text-emerald-400"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg></span>
                            {t('admin.communityCacheTitle')}
                        </h2>
                        <div className="space-y-4 flex-grow">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700/30">
                                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">{t('admin.totalSize')}</p>
                                    <p className="text-xl font-mono font-bold text-white">{filesize(cacheInfo.community.db_size_bytes, {base: 2, standard: "jedec"})}</p>
                                </div>
                                <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700/30">
                                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">{t('toolPanel.sectionCommunity')}</p>
                                    <p className="text-xl font-mono font-bold text-white">{cacheInfo.community.song_count} songs</p>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-900/30 rounded-2xl border border-gray-700/30">
                                <p className="text-xs text-gray-500 font-bold uppercase mb-2">{t('admin.communityQuota')}</p>
                                <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2 overflow-hidden shadow-inner">
                                    <div className="bg-indigo-500 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (cacheInfo.community.db_size_bytes / cacheInfo.community.quota_bytes) * 100)}%` }}></div>
                                </div>
                                <p className="text-[10px] text-gray-400 text-right font-mono">{filesize(cacheInfo.community.db_size_bytes)} / {filesize(cacheInfo.community.quota_bytes)}</p>
                            </div>
                        </div>
                    </div>
                  </div>

                  <SectionCard title={t('admin.transcriptionTasksTitle')} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" /></svg>}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase border-b border-gray-700/50">
                          <tr>
                            <th className="px-4 py-3 font-bold">URL</th>
                            <th className="px-4 py-3 font-bold text-center">Status</th>
                            <th className="px-4 py-3 font-bold text-right">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/30">
                          {tasks.length > 0 ? tasks.map((task, i) => (
                            <tr key={i} className="hover:bg-gray-700/20 transition-colors">
                              <td className="px-4 py-4 truncate max-w-xs font-mono text-xs text-indigo-300" title={task.url}>{task.url}</td>
                              <td className="px-4 py-4 text-center">
                                <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm", 
                                    task.status === 'completed' ? "bg-emerald-900/40 text-emerald-400 border border-emerald-800/50" : 
                                    task.status === 'error' ? "bg-red-900/40 text-red-400 border border-red-800/50" : 
                                    "bg-amber-900/40 text-amber-400 border border-amber-800/50")}>
                                  {task.status} {task.status !== 'completed' && task.status !== 'error' && `(#${task.queue_position})`}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-right text-gray-500 font-mono text-xs">{new Date(task.created_at).toLocaleString()}</td>
                            </tr>
                          )) : (
                            <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-600 font-medium italic">{t('admin.noTasksRunning')}</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button
                      onClick={handleSaveConfig}
                      disabled={isSaving}
                      className="flex-grow py-4 bg-indigo-600 rounded-2xl hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-900/30 active:scale-95 flex items-center justify-center gap-2 border border-indigo-500/30 disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                      {isSaving ? t('admin.savingButton') : t('admin.saveConfigButton')}
                    </button>
                    <button
                      onClick={handleLogout}
                      className="px-8 py-4 bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 rounded-2xl transition-all font-bold border border-gray-700/50 shadow-md active:scale-95"
                    >
                      {t('admin.logoutButton')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const CacheCard = ({ title, info, policy, onPolicyChange, onClear, t }: { 
    title: string, info: CacheInfo, policy: CleanupPolicy, 
    onPolicyChange: (p: CleanupPolicy) => void, onClear: () => void,
    t: (k: string, o?: any) => string 
}) => (
  <div className="bg-gray-800/40 backdrop-blur-sm rounded-3xl border border-gray-700/50 p-6 sm:p-8 shadow-lg flex flex-col">
    <h2 className="text-xl font-bold text-gray-200 uppercase tracking-wider mb-6 flex items-center gap-3">
        <span className="text-indigo-400"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg></span>
        {title}
    </h2>
    <div className="space-y-6 flex-grow">
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700/30">
                <p className="text-xs text-gray-500 font-bold uppercase mb-1">{t('admin.totalSize')}</p>
                <p className="text-xl font-mono font-bold text-white">{filesize(info.size_bytes, {base: 2, standard: "jedec"})}</p>
            </div>
            {info.file_count !== undefined && (
                <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700/30">
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">{t('admin.fileCount')}</p>
                    <p className="text-xl font-mono font-bold text-white">{info.file_count}</p>
                </div>
            )}
        </div>

        <div className="p-5 bg-indigo-900/10 rounded-2xl border border-indigo-500/10 space-y-4">
            <p className="text-xs text-indigo-300 font-bold uppercase tracking-widest border-b border-indigo-500/20 pb-2">{t('admin.autoCleanPolicy')}</p>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1 ml-1">{t('admin.maxSize')} (GB)</label>
                    <input
                        type="number"
                        value={policy.max_size_gb}
                        onChange={(e) => onPolicyChange({ ...policy, max_size_gb: Number(e.target.value) })}
                        className="w-full p-2 bg-gray-900/50 border border-gray-700/50 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
                <div>
                    <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1 ml-1">{t('admin.maxAge')} (Days)</label>
                    <input
                        type="number"
                        value={policy.max_age_days}
                        onChange={(e) => onPolicyChange({ ...policy, max_age_days: Number(e.target.value) })}
                        className="w-full p-2 bg-gray-900/50 border border-gray-700/50 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
            </div>
        </div>
    </div>
    <button
      onClick={onClear}
      className="mt-6 w-full py-3 bg-red-900/20 text-red-300 border border-red-800/30 hover:bg-red-600 hover:text-white rounded-xl transition-all font-bold shadow-sm"
    >
      {t('admin.clearNowButton')}
    </button>
  </div>
);

export default AdminPage;