import React, { useState, useEffect, useCallback } from 'react';
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

    const loadConfig = async () => {
        const settings = await db.settings.get(0);
        setBackendUrl(settings?.backendUrl || 'http://localhost:8000');
        setSharerNickname(settings?.sharerNickname?.trim() || '');
    };

    const fetchSongs = useCallback(async () => {
        if (!backendUrl || !sharerNickname) return;
        setIsLoading(true);
        setError(null);
        try {
            const url = new URL(`${backendUrl}/api/community/songs`);
            url.searchParams.append('sharer', sharerNickname);
            const res = await fetch(url.toString());
            if (!res.ok) throw new Error('Failed to fetch shared songs');
            const data = await res.json();
            setSongs(data.songs);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [backendUrl, sharerNickname]);

    useEffect(() => {
        loadConfig();
    }, []);

    useEffect(() => {
        if (backendUrl && sharerNickname) {
            fetchSongs();
        }
    }, [backendUrl, sharerNickname, fetchSongs]);

    const handleDelete = async (songId: number) => {
        if (!window.confirm(t('myShared.deleteConfirm'))) return;

        try {
            const url = new URL(`${backendUrl}/api/community/songs/${songId}`);
            url.searchParams.append('sharer_name', sharerNickname);
            const res = await fetch(url.toString(), { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete shared song');
            
            // Remove from state
            setSongs(prev => prev.filter(s => s.id !== songId));
            alert(t('myShared.deleteSuccess'));
        } catch (e) {
            alert(t('myShared.deleteError', { error: (e as Error).message }));
        }
    };

    return (
        <>
            <Head>
                <title>{`J-Melo - ${t('home.mySharedButton')}`}</title>
            </Head>

            <main className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                        <div>
                            <h1 className="text-3xl font-bold">{t('home.mySharedButton')}</h1>
                            <p className="text-gray-400 mt-2">{t('myShared.sharerLabel')}: <span className="font-semibold text-teal-400">{sharerNickname || t('common.na')}</span></p>
                        </div>
                        <Link href="/" className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-white w-full sm:w-auto text-center">
                            {t('settings.backToPlayer')}
                        </Link>
                    </header>

                    {!sharerNickname && (
                         <div className="bg-yellow-800 p-4 rounded-lg mb-6 text-center text-yellow-200">
                             {t('myShared.noNicknameWarning')}
                         </div>
                    )}

                    {error && (
                        <div className="bg-red-800 p-4 rounded-lg mb-6 text-center">
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="text-center py-12 text-gray-400">
                            {t('home.loadingSongs')}
                        </div>
                    ) : songs.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            {t('myShared.noSharedSongs')}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {songs.map((song) => (
                                <div key={song.id} className="bg-gray-800 p-4 rounded-lg shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-gray-700 flex-shrink-0 rounded overflow-hidden">
                                            {song.cover_url && <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold">{song.title}</h2>
                                            <p className="text-sm text-gray-400">{song.artist || t('home.unknownArtist')}</p>
                                            <p className="text-xs text-gray-500 mt-1">{new Date(song.created_at).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleDelete(song.id)}
                                        className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500 w-full sm:w-auto text-sm font-bold"
                                    >
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