// src/components/explore/MySharedPanel.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useTranslation from '@/hooks/useTranslation';
import { db } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import useSettingsStore from '@/stores/useSettingsStore';
import toast from 'react-hot-toast';
import { buildApiUrl, deleteJson, getJson } from '@/lib/backendClient';

interface CommunitySong {
    id: number;
    title: string;
    artist: string;
    cover_url: string;
    sharer_name: string;
    created_at: string;
}

interface MySharedPanelProps {
    onClose: () => void;
}

const MySharedPanel: React.FC<MySharedPanelProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const { settings, loadSettings } = useSettingsStore();
    const [songs, setSongs] = useState<CommunitySong[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const backendUrl = settings.backendUrl;
    const sharerNickname = settings.sharerNickname;

    useEffect(() => {
        setMounted(true);
        loadSettings();
        return () => setMounted(false);
    }, [loadSettings]);

    useEffect(() => {
        const fetchMySongs = async () => {
            if (!backendUrl || !sharerNickname) return;
            setIsLoading(true);
            setError(null);
            try {
                const data = await getJson<{ songs: CommunitySong[] }>(backendUrl, '/api/community/songs', { sharer: sharerNickname });
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
            await deleteJson(backendUrl, `/api/community/songs/${songId}`, { sharer_name: sharerNickname });
            toast.success(t('myShared.deleteSuccess'));
            setSongs(prev => prev.filter(s => s.id !== songId));
        } catch (err) {
            toast.error(t('myShared.deleteError', { error: (err as Error).message }));
        }
    };

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 backdrop-blur-md p-4 sm:p-6 pt-12 sm:pt-20" onClick={onClose}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-3xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-gray-800 border border-gray-700 w-full flex flex-col rounded-[2.5rem] shadow-2xl overflow-hidden text-white">
                    {/* Header */}
                    <div className="flex justify-between items-center p-6 border-b border-gray-700/30 bg-gray-900/30 flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="bg-gray-900/50 p-2 rounded-xl border border-gray-700/50 flex-shrink-0">
                                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                            </div>
                            <div className="truncate">
                                <h2 className="text-xl font-bold">{t('home.mySharedButton')}</h2>
                                <p className="text-xs text-gray-400 mt-0.5">{t('myShared.sharerLabel')}: <span className="text-emerald-400 font-bold">{sharerNickname || t('common.na')}</span></p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-600 rounded-full transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-grow overflow-y-auto p-6 custom-scrollbar space-y-4 min-h-[300px]">
                        {!sharerNickname && (
                            <div className="bg-yellow-900/20 border border-yellow-700/30 p-4 rounded-2xl text-center text-yellow-200">
                                {t('myShared.noNicknameWarning')}
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-900/20 border border-red-800/30 p-4 rounded-2xl text-center text-red-200">
                                {error}
                            </div>
                        )}

                        {isLoading ? (
                            <div className="flex justify-center py-20">
                                <svg className="animate-spin h-10 w-10 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            </div>
                        ) : songs.length === 0 ? (
                            <div className="text-center py-20 text-gray-500 font-medium">
                                {t('myShared.noSharedSongs')}
                            </div>
                        ) : (
                            songs.map((song) => (
                                <div
                                    key={song.id}
                                    className="bg-gray-900/40 border border-gray-700/50 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-gray-600 transition-colors group"
                                >
                                    <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                                        <div className="w-16 h-16 bg-gray-700 flex-shrink-0 rounded-xl overflow-hidden shadow-inner">
                                            {song.cover_url ? (
                                                <img
                                                    src={song.cover_url.startsWith('/') ? buildApiUrl(backendUrl, song.cover_url) : buildApiUrl(backendUrl, '/api/media/proxy-image', { url: song.cover_url })}
                                                    alt={song.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center w-full h-full text-gray-500">
                                                    <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-grow">
                                            <h3 className="text-lg font-bold truncate text-white" title={song.title}>{song.title}</h3>
                                            <p className="text-sm text-gray-400 truncate">{song.artist}</p>
                                            <p className="text-[10px] text-gray-500 mt-1 font-mono">{new Date(song.created_at).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(song.id)}
                                        className="w-full sm:w-auto px-4 py-2 flex-shrink-0 bg-red-900/40 text-red-300 border border-red-800/50 rounded-xl hover:bg-red-600 hover:text-white transition-all text-sm font-bold flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        {t('home.deleteButton')}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </motion.div>
        </div>,
        document.body
    );
};

export default MySharedPanel;
