// src/pages/my-shared.tsx
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import useTranslation from '@/hooks/useTranslation';
import { db } from '@/lib/db';

interface CommunitySong {
    id: number;
    title: string;
    artist: string;
    cover_url: string;
    sharer_name: string;
    created_at: string;
}

const MySharedPage: React.FC = () => {
    const { t } = useTranslation();
    const [songs, setSongs] = useState<CommunitySong[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [backendUrl, setBackendUrl] = useState('');
    const [sharerNickname, setSharerNickname] = useState('');

    useEffect(() => {
        const loadSettings = async () => {
            const settings = await db.settings.get(0);
            setBackendUrl(settings?.backendUrl || 'http://localhost:8000');
            setSharerNickname(settings?.sharerNickname || '');
        };
        loadSettings();
    }, []);

    useEffect(() => {
        const fetchMySongs = async () => {
            if (!backendUrl || !sharerNickname) return;
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch(`${backendUrl}/api/community/songs?sharer=${encodeURIComponent(sharerNickname)}`);
                if (!res.ok) throw new Error('Failed to fetch your shared songs');
                const data = await res.json();
                setSongs(data.songs);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMySongs();
    }, [backendUrl, sharerNickname]);

    const handleDelete = async (songId: number) => {
        if (!window.confirm(t('myShared.deleteConfirm'))) return;
        try {
            const res = await fetch(`${backendUrl}/api/community/songs/${songId}?sharer_name=${encodeURIComponent(sharerNickname)}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to delete song');
            setSongs(prev => prev.filter(s => s.id !== songId));
        } catch (err) {
            alert(t('myShared.deleteError', { error: (err as Error).message }));
        }
    };

    return (
        <>
            <Head>
                <title>{`J-Melo - ${t('home.mySharedButton')}`}</title>
            </Head>

            <main className="bg-[#0f172a] min-h-screen text-white pb-12 selection:bg-indigo-500/30">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
                    {/* Header */}
                    <header className="relative z-[100] flex flex-row justify-between items-center gap-2 sm:gap-6 mb-8 bg-gray-800/40 p-3 sm:p-5 rounded-[2rem] border border-gray-700/50 shadow-lg backdrop-blur-sm flex-shrink-0">
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                            <div className="bg-gray-900/50 p-1.5 sm:p-2.5 rounded-2xl shadow-inner border border-gray-700/50 flex-shrink-0">
                                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                            </div>
                            <div className="truncate">
                                <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent truncate">{t('home.mySharedButton')}</h1>
                                <p className="text-gray-400 mt-0.5 text-[10px] sm:text-xs truncate">{t('myShared.sharerLabel')}: <span className="font-semibold text-emerald-400 ml-1 px-1.5 py-0.5 bg-emerald-900/30 rounded-md border border-emerald-800/50">{sharerNickname || t('common.na')}</span></p>
                            </div>
                        </div>
                        <Link href="/" className="p-2 sm:p-2.5 bg-gray-700/80 text-gray-200 rounded-xl hover:bg-gray-600 hover:text-white transition-all flex items-center justify-center border border-gray-600/50 shadow-sm flex-shrink-0" title={t('settings.backToPlayer')}>
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </Link>
                    </header>

                    {!sharerNickname && (
                         <div className="bg-yellow-900/40 border border-yellow-700/50 p-4 rounded-2xl mb-8 text-center text-yellow-200 shadow-sm flex flex-col items-center gap-2">
                             <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                             {t('myShared.noNicknameWarning')}
                         </div>
                    )}

                    {error && (
                        <div className="bg-red-900/40 border border-red-800 p-4 rounded-2xl mb-8 text-center text-red-200 shadow-sm">
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <svg className="animate-spin h-10 w-10 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <p className="text-gray-400 font-medium tracking-wide animate-pulse">{t('home.loadingSongs')}</p>
                        </div>
                    ) : songs.length === 0 ? (
                        <div className="text-center py-20 bg-gray-800/30 rounded-3xl border border-gray-700/30 border-dashed max-w-2xl mx-auto">
                            <div className="bg-gray-900/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                            </div>
                            <p className="text-xl text-gray-300 font-medium mb-2">{t('myShared.noSharedSongs')}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {songs.map((song) => (
                                <div 
                                    key={song.id} 
                                    className="bg-gray-800/60 backdrop-blur-sm p-4 rounded-2xl border border-gray-700/50 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 hover:border-gray-600 transition-colors group select-none"
                                    style={{ WebkitTouchCallout: 'none' }}
                                >
                                    <div className="flex items-center gap-5 w-full sm:w-auto">
                                        <div className="w-20 h-20 bg-gray-700 flex-shrink-0 rounded-xl overflow-hidden shadow-inner border border-gray-600/30">
                                            {song.cover_url ? (
                                                <img
                                                    src={song.cover_url.startsWith('/') ? `${backendUrl}${song.cover_url}` : song.cover_url} 
                                                    alt={song.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center w-full h-full text-gray-500">
                                                    <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <h2 className="text-xl font-bold text-white truncate mb-1">{song.title}</h2>
                                            <p className="text-sm text-gray-400 truncate mb-1.5">{song.artist}</p>
                                            <p className="text-xs text-gray-500 font-mono bg-gray-900/50 inline-block px-2 py-0.5 rounded border border-gray-700/50">{new Date(song.created_at).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleDelete(song.id)}
                                        className="w-full sm:w-auto px-5 py-2.5 bg-red-900/40 text-red-300 border border-red-800/50 rounded-xl hover:bg-red-600 hover:text-white hover:border-red-500 transition-all font-medium flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        {t('home.deleteButton')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </>
    );
};

export default MySharedPage;