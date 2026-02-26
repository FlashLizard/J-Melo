import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import useTranslation from '@/hooks/useTranslation';
import { filesize } from 'filesize';

interface CacheInfo {
  size_bytes: number;
  file_count?: number;
}

interface CachePolicy {
    max_size_gb?: number;
    max_age_days?: number;
    max_size_mb?: number;
    max_age_hours?: number;
}

interface CommunitySongAdmin {
    id: number;
    title: string;
    artist: string;
    sharer_name: string;
    created_at: string;
}

const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{
    media_cache: CacheInfo;
    token_cache: CacheInfo;
    transcription_cache: CacheInfo;
    community_db: CacheInfo;
  } | null>(null);
  const [policies, setPolicies] = useState<{
    admin_token?: string;
    proxy?: string;
    media_cache_policy: CachePolicy;
    token_cache_policy: CachePolicy;
    transcription_cache_policy: CachePolicy;
    community_policy: CachePolicy;
  } | null>(null);
  const [transcriptionTasks, setTranscriptionTasks] = useState<Record<string, any>>({});
  const [communitySongs, setCommunitySongs] = useState<CommunitySongAdmin[]>([]);
  const [isManagingCommunity, setIsManagingCommunity] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [backendUrl, setBackendUrl] = useState('');

  useEffect(() => {
    const getUrl = async () => {
        try {
            const settingsModule = await import('@/stores/useSettingsStore');
            await settingsModule.default.getState().loadSettings();
            const url = settingsModule.default.getState().settings.backendUrl;
            setBackendUrl(url);
        } catch(e) {
            setBackendUrl('http://localhost:8000');
        }
    };
    getUrl();
  }, []);

  const handleLogin = () => {
    if (!token) {
      setError(t('admin.tokenRequired'));
      return;
    }
    setIsAuthenticated(true);
    setError(null);
  };

  const fetchData = async () => {
    if (!backendUrl) return;
    setIsLoading(true);
    try {
      const [infoResponse, configResponse, tasksResponse] = await Promise.all([
        fetch(`${backendUrl}/api/admin/cache-info`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${backendUrl}/api/admin/config`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${backendUrl}/api/admin/transcription-tasks`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (infoResponse.status === 403 || configResponse.status === 403 || tasksResponse.status === 403) {
        throw new Error(t('admin.invalidToken'));
      }
      if (!infoResponse.ok || !configResponse.ok || !tasksResponse.ok) {
        throw new Error(t('admin.fetchError'));
      }
      
      const infoData = await infoResponse.json();
      const configData = await configResponse.json();
      const tasksData = await tasksResponse.json();
      
      setCacheInfo(infoData);
      setPolicies(configData);
      setTranscriptionTasks(tasksData);
    } catch (e) {
      setError((e as Error).message);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && backendUrl) {
      fetchData();
    }
  }, [isAuthenticated, backendUrl]);

  const handleClearCache = async (cacheName: 'media' | 'tokens' | 'transcriptions') => {
    if (!window.confirm(t('admin.confirmClear', { cacheName }))) return;
    setIsLoading(true);
    try {
        const response = await fetch(`${backendUrl}/api/admin/clear-cache`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ cache_name: cacheName }),
        });
        if (response.status === 403) throw new Error(t('admin.invalidToken'));
        if (!response.ok) throw new Error(t('admin.clearError'));
        alert(t('admin.clearSuccess', { cacheName }));
        fetchData();
    } catch (e) {
        setError((e as Error).message);
        setIsAuthenticated(false);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSavePolicies = async () => {
    setIsSaving(true);
    try {
        const response = await fetch(`${backendUrl}/api/admin/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(policies),
        });
        if (response.status === 403) throw new Error(t('admin.invalidToken'));
        if (!response.ok) throw new Error(t('admin.saveConfigError'));
        alert(t('admin.saveConfigSuccess'));
    } catch (e) {
        setError((e as Error).message);
        setIsAuthenticated(false);
    } finally {
        setIsSaving(false);
    }
  };

  const handlePolicyChange = (cacheType: 'media_cache_policy' | 'token_cache_policy' | 'transcription_cache_policy' | 'community_policy', field: string, value: string) => {
    if (!policies) return;
    const numValue = value === '' ? null : Number(value);
    setPolicies({
        ...policies,
        [cacheType]: {
            ...(policies[cacheType] || {}),
            [field]: numValue,
        },
    });
  };

  const loadCommunitySongs = async () => {
      setIsLoading(true);
      try {
          const res = await fetch(`${backendUrl}/api/admin/community/songs`, { headers: { 'Authorization': `Bearer ${token}` } });
          if (!res.ok) throw new Error('Failed to fetch community songs');
          const data = await res.json();
          setCommunitySongs(data.songs);
          setIsManagingCommunity(true);
      } catch (e) {
          setError((e as Error).message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleAdminDeleteCommunitySong = async (id: number) => {
      if (!window.confirm(t('admin.communityDeleteConfirm'))) return;
      try {
          const res = await fetch(`${backendUrl}/api/admin/community/songs/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error(t('admin.communityDeleteError'));
          setCommunitySongs(prev => prev.filter(s => s.id !== id));
          alert(t('admin.communityDeleteSuccess'));
          fetchData(); // refresh size
      } catch (e) {
          alert((e as Error).message);
      }
  };

  if (!backendUrl) return null;

  return (
    <div className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="J-Melo Logo" className="w-10 h-10 drop-shadow-lg" />
            <h1 className="text-3xl font-bold text-white">{t('admin.title')}</h1>
          </div>
          <Link href="/settings" className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-white">
            {t('admin.backToSettings')}
          </Link>
        </header>

        {error && (
          <div className="bg-red-800 border border-red-600 p-3 rounded-md mb-4 text-center">
            <p>{error}</p>
          </div>
        )}

        {!isAuthenticated ? (
          <div className="bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">{t('admin.authTitle')}</h2>
            <p className="text-gray-400 mb-4">{t('admin.authDescription')}</p>
            <div className="flex gap-2">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('admin.tokenPlaceholder')}
                className="flex-grow p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button onClick={handleLogin} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 font-bold">{t('admin.loginButton')}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {(isLoading && !cacheInfo) ? (
                <p className='text-center'>{t('admin.loadingInfo')}</p>
            ) : cacheInfo && policies && (
              <>
                {/* General Settings Section */}
                <div className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
                  <h2 className="text-xl font-semibold border-b border-gray-700 pb-3">{t('admin.generalSettingsTitle')}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.proxyLabel')}</label>
                      <input
                        type="text"
                        value={policies.proxy || ''}
                        onChange={(e) => setPolicies({ ...policies, proxy: e.target.value })}
                        placeholder="http://127.0.0.1:7890"
                        className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.adminTokenLabel')}</label>
                      <input
                        type="text"
                        value={policies.admin_token || ''}
                        onChange={(e) => setPolicies({ ...policies, admin_token: e.target.value })}
                        className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Media Cache Section */}
                <div className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
                  <h2 className="text-xl font-semibold border-b border-gray-700 pb-3">{t('admin.mediaCacheTitle')}</h2>
                  <div className="flex justify-between items-center">
                    <div>
                      <p>{t('admin.totalSize')}: <span className="font-bold text-green-400">{filesize(cacheInfo.media_cache.size_bytes)}</span></p>
                      <p>{t('admin.fileCount')}: <span className="font-bold text-green-400">{cacheInfo.media_cache.file_count}</span></p>
                    </div>
                    <button onClick={() => handleClearCache('media')} disabled={isLoading} className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500 text-white disabled:opacity-50 font-bold">
                      {t('admin.clearNowButton')}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">{t('admin.autoCleanPolicy')}</h3>
                    <div className='flex items-center gap-4'>
                        <div>
                           <label className="block text-sm font-medium text-gray-300">{t('admin.maxSize')} (GB)</label>
                           <input type='number' value={policies.media_cache_policy.max_size_gb ?? ''} onChange={e => handlePolicyChange('media_cache_policy', 'max_size_gb', e.target.value)} className='w-full p-2 rounded bg-gray-700 border border-gray-600' />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-gray-300">{t('admin.maxAge')} (Days)</label>
                           <input type='number' value={policies.media_cache_policy.max_age_days ?? ''} onChange={e => handlePolicyChange('media_cache_policy', 'max_age_days', e.target.value)} className='w-full p-2 rounded bg-gray-700 border border-gray-600' />
                        </div>
                    </div>
                  </div>
                </div>

                {/* Token Cache Section */}
                <div className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
                  <h2 className="text-xl font-semibold border-b border-gray-700 pb-3">{t('admin.tokenCacheTitle')}</h2>
                  <div className="flex justify-between items-center">
                    <div>
                      <p>{t('admin.totalSize')}: <span className="font-bold text-green-400">{filesize(cacheInfo.token_cache.size_bytes)}</span></p>
                      <p>{t('admin.fileCount')}: <span className="font-bold text-green-400">{cacheInfo.token_cache.file_count}</span></p>
                    </div>
                    <button onClick={() => handleClearCache('tokens')} disabled={isLoading} className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500 text-white disabled:opacity-50 font-bold">
                      {t('admin.clearNowButton')}
                    </button>
                  </div>
                   <div className="space-y-2">
                    <h3 className="text-lg font-medium">{t('admin.autoCleanPolicy')}</h3>
                     <div className='flex items-center gap-4'>
                        <div>
                           <label className="block text-sm font-medium text-gray-300">{t('admin.maxSize')} (MB)</label>
                           <input type='number' value={policies.token_cache_policy?.max_size_mb ?? ''} onChange={e => handlePolicyChange('token_cache_policy', 'max_size_mb', e.target.value)} className='w-full p-2 rounded bg-gray-700 border border-gray-600' />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-gray-300">{t('admin.maxAge')} (Hours)</label>
                           <input type='number' value={policies.token_cache_policy?.max_age_hours ?? ''} onChange={e => handlePolicyChange('token_cache_policy', 'max_age_hours', e.target.value)} className='w-full p-2 rounded bg-gray-700 border border-gray-600' />
                        </div>
                    </div>
                  </div>
                </div>

                {/* Transcription Cache Section */}
                <div className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
                  <h2 className="text-xl font-semibold border-b border-gray-700 pb-3">{t('admin.transcriptionCacheTitle')}</h2>
                  <div className="flex justify-between items-center">
                    <div>
                      <p>{t('admin.totalSize')}: <span className="font-bold text-green-400">{filesize(cacheInfo.transcription_cache?.size_bytes || 0)}</span></p>
                      <p>{t('admin.fileCount')}: <span className="font-bold text-green-400">{cacheInfo.transcription_cache?.file_count || 0}</span></p>
                    </div>
                    <button onClick={() => handleClearCache('transcriptions')} disabled={isLoading} className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500 text-white disabled:opacity-50 font-bold">
                      {t('admin.clearNowButton')}
                    </button>
                  </div>
                   <div className="space-y-2">
                    <h3 className="text-lg font-medium">{t('admin.autoCleanPolicy')}</h3>
                     <div className='flex items-center gap-4'>
                        <div>
                           <label className="block text-sm font-medium text-gray-300">{t('admin.maxSize')} (MB)</label>
                           <input type='number' value={policies.transcription_cache_policy?.max_size_mb ?? ''} onChange={e => handlePolicyChange('transcription_cache_policy', 'max_size_mb', e.target.value)} className='w-full p-2 rounded bg-gray-700 border border-gray-600' />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-gray-300">{t('admin.maxAge')} (Days)</label>
                           <input type='number' value={policies.transcription_cache_policy?.max_age_days ?? ''} onChange={e => handlePolicyChange('transcription_cache_policy', 'max_age_days', e.target.value)} className='w-full p-2 rounded bg-gray-700 border border-gray-600' />
                        </div>
                    </div>
                  </div>

                  {/* Tasks Sub-panel */}
                  <div className="mt-4 border-t border-gray-700 pt-4">
                      <h3 className="text-lg font-medium mb-2">{t('admin.transcriptionTasksTitle')}</h3>
                      {Object.keys(transcriptionTasks).length === 0 ? (
                          <p className="text-sm text-gray-400">{t('admin.noTasksRunning')}</p>
                      ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                              {Object.entries(transcriptionTasks).map(([mediaId, task]) => (
                                  <div key={mediaId} className="bg-gray-700 p-2 rounded text-sm flex flex-col gap-1">
                                      <div className="flex justify-between items-center">
                                          <div className="font-bold text-indigo-300 truncate pr-2" title={task.display_name}>
                                              {task.display_name || mediaId}
                                          </div>
                                          <span className={`font-bold text-xs uppercase px-1.5 py-0.5 rounded ${task.status === 'processing' ? 'bg-yellow-500/20 text-yellow-400' : task.status === 'completed' ? 'bg-green-500/20 text-green-400' : task.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-gray-600 text-gray-300'}`}>
                                              {task.status}
                                          </span>
                                      </div>
                                      <div className="flex justify-between items-center text-[10px] text-gray-500">
                                          <span className="font-mono">{mediaId}</span>
                                          <span>{new Date(task.started_at).toLocaleString()}</span>
                                      </div>
                                      {task.error && <p className="text-red-400 text-xs mt-1 border-t border-red-900/30 pt-1 italic">{task.error}</p>}
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                </div>

                {/* Community Database Section */}
                <div className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
                  <h2 className="text-xl font-semibold border-b border-gray-700 pb-3">{t('admin.communityCacheTitle')}</h2>
                  <div className="flex justify-between items-center">
                    <div>
                      <p>{t('admin.totalSize')}: <span className="font-bold text-green-400">{filesize(cacheInfo.community_db?.size_bytes || 0)}</span></p>
                    </div>
                    <button onClick={loadCommunitySongs} disabled={isLoading} className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 text-white disabled:opacity-50 font-bold">
                      {t('admin.communityManageSongsButton')}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">{t('admin.autoCleanPolicy')}</h3>
                     <div className='flex items-center gap-4'>
                        <div>
                           <label className="block text-sm font-medium text-gray-300">{t('admin.communityQuota')} (MB)</label>
                           <input type='number' value={policies.community_policy?.max_size_mb ?? ''} onChange={e => handlePolicyChange('community_policy', 'max_size_mb', e.target.value)} className='w-full p-2 rounded bg-gray-700 border border-gray-600' />
                        </div>
                    </div>
                  </div>
                  
                  {/* Community Songs Management Panel */}
                  {isManagingCommunity && (
                    <div className="mt-6 border-t border-gray-700 pt-4">
                        <div className="flex justify-between items-center mb-4">
                           <h3 className="text-lg font-bold">{t('admin.communityManageTitle')}</h3>
                           <button onClick={() => setIsManagingCommunity(false)} className="text-sm text-gray-400 hover:text-white">{t('admin.closeButton') || 'Close'}</button>
                        </div>
                        {communitySongs.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">{t('admin.communityNoSongs')}</p>
                        ) : (
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                {communitySongs.map(song => (
                                    <div key={song.id} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                                        <div className="truncate pr-4 flex-grow">
                                            <p className="font-semibold truncate">{song.title}</p>
                                            <p className="text-xs text-gray-400 truncate">{song.artist} • {song.sharer_name}</p>
                                        </div>
                                        <button onClick={() => handleAdminDeleteCommunitySong(song.id)} className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs font-bold flex-shrink-0">
                                            {t('home.deleteButton')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                  )}
                </div>

                <div className="text-center pt-4 flex flex-col sm:flex-row justify-center items-center gap-4">
                    <button onClick={handleSavePolicies} disabled={isSaving} className="px-6 py-2 bg-green-700 rounded-lg hover:bg-green-600 text-white disabled:opacity-50 font-bold w-full sm:w-auto">
                        {isSaving ? t('admin.savingButton') : t('admin.saveConfigButton')}
                    </button>
                    <button onClick={() => { setIsAuthenticated(false); setToken(''); setCacheInfo(null); }} className="text-gray-400 hover:text-white text-sm w-full sm:w-auto">{t('admin.logoutButton')}</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
