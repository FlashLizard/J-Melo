import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SongRecord, WordRecord, db } from '@/lib/db';
import useTranslation from '@/hooks/useTranslation';
import cn from 'classnames';
import { buildApiUrl, getJson } from '@/lib/backendClient';

interface CommunitySong {
    id: number;
    title: string;
    artist: string;
    cover_url: string;
    sharer_name: string;
    created_at: string;
}

interface SongPreviewModalProps {
    communitySong: CommunitySong;
    backendUrl: string;
    onClose: () => void;
    onImport: (songData: SongRecord, wordsData: WordRecord[]) => void;
    onUpdateCommunity: (songData: SongRecord, wordsData: WordRecord[]) => void;
    onDeleteCommunity: (songId: number) => void;
    myNickname: string;
}

const SongPreviewModal: React.FC<SongPreviewModalProps> = ({ communitySong, backendUrl, onClose, onImport, onUpdateCommunity, onDeleteCommunity, myNickname }) => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [songData, setSongData] = useState<SongRecord | null>(null);
    const [wordsData, setWordsData] = useState<WordRecord[]>([]);
    const [activeTab, setActiveTab] = useState<'lyrics' | 'words'>('lyrics');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        const fetchDetails = async () => {
            setIsLoading(true);
            try {
                const parsedData = await getJson<{ songs: SongRecord[]; words: WordRecord[] }>(
                    backendUrl,
                    `/api/community/songs/${communitySong.id}`
                );
                
                const fetchedSong = (parsedData.songs || [])[0];
                if (!fetchedSong) throw new Error("No song data found in this package.");
                
                setSongData(fetchedSong);
                setWordsData(parsedData.words || []);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDetails();
    }, [communitySong.id, backendUrl]);

    const [currentTime, setCurrentTime] = useState(0);

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
        setCurrentTime(e.currentTarget.currentTime);
    };

    const isMyShare = myNickname && communitySong.sharer_name === myNickname;

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 w-full max-w-4xl h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-700/50 bg-gray-900/50 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-lg bg-gray-700 overflow-hidden flex-shrink-0">
                            {communitySong.cover_url ? (
                                <img src={communitySong.cover_url.startsWith('/') ? buildApiUrl(backendUrl, communitySong.cover_url) : communitySong.cover_url} alt={t('player.albumCoverAlt')} className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex items-center justify-center w-full h-full text-gray-500">{t('explore.preview.noCover')}</div>
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white line-clamp-1">{communitySong.title}</h2>
                            <p className="text-sm text-gray-400 line-clamp-1">{communitySong.artist}</p>
                            <p className="text-xs text-indigo-400 mt-1">{t('explore.preview.sharedBy')} {communitySong.sharer_name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-full transition-colors self-start flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-grow overflow-hidden flex flex-col min-h-0">
                    {isLoading ? (
                        <div className="flex-grow flex items-center justify-center text-gray-400">{t('explore.preview.loadingDetails')}</div>
                    ) : error ? (
                        <div className="flex-grow flex items-center justify-center text-red-400">{error}</div>
                    ) : (
                        <>
                            {/* Audio Preview */}
                            {songData?.media_url && (
                                <div className="p-4 border-b border-gray-700/50 bg-gray-800/80 flex justify-center flex-shrink-0">
                                    <audio
                                        controls
                                        onTimeUpdate={handleTimeUpdate}
                                        src={songData.media_url.startsWith('http') ? songData.media_url : buildApiUrl(backendUrl, songData.media_url)}
                                        className="w-full max-w-md h-10 outline-none"
                                    />
                                </div>
                            )}

                            {/* Tabs */}
                            <div className="flex border-b border-gray-700 bg-gray-900/30 flex-shrink-0">
                                <button 
                                    onClick={() => setActiveTab('lyrics')}
                                    className={cn("px-6 py-3 text-sm font-medium transition-colors border-b-2", activeTab === 'lyrics' ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800")}
                                >
                                    {t('explore.preview.lyricsTab')}
                                </button>
                                <button 
                                    onClick={() => setActiveTab('words')}
                                    className={cn("px-6 py-3 text-sm font-medium transition-colors border-b-2", activeTab === 'words' ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800")}
                                >
                                    {t('explore.preview.vocabTab').replace('{{count}}', wordsData.length.toString())}
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="flex-grow overflow-y-auto p-4 custom-scrollbar bg-gray-900/20 relative">
                                {activeTab === 'lyrics' && (
                                    <div className="space-y-6 max-w-2xl mx-auto pb-8">
                                        {songData?.lyrics && songData.lyrics.length > 0 ? (
                                            songData.lyrics.map((line, idx) => {
                                                const isActive = line.startTime > 0 && currentTime >= line.startTime && currentTime <= (line.endTime || line.startTime + 2);
                                                return (
                                                    <div key={idx} className={cn("text-center transition-all duration-300", isActive ? "scale-105" : "opacity-60 hover:opacity-80")}>
                                                        <p className={cn("text-xl font-bold mb-1", isActive ? "text-green-400" : "text-gray-200")}>{line.text}</p>
                                                        {line.translation && <p className={cn("text-sm", isActive ? "text-green-200/80" : "text-gray-500")}>{line.translation}</p>}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-center text-gray-500 mt-10">{t('explore.preview.noLyrics')}</div>
                                        )}
                                    </div>
                                )}
                                {activeTab === 'words' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
                                        {wordsData.length > 0 ? wordsData.map((word, idx) => (
                                            <div key={idx} className="bg-gray-800 border border-gray-700 p-3 rounded-xl shadow-sm hover:border-gray-600 transition-colors">
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span className="text-white font-bold text-lg">{word.surface}</span>
                                                    <span className="text-gray-400 text-xs">{word.reading}</span>
                                                </div>
                                                <p className="text-gray-300 text-sm line-clamp-2" title={word.cardBack}>{word.cardBack}</p>
                                            </div>
                                        )) : (
                                            <div className="col-span-full text-center text-gray-500 mt-10">{t('explore.preview.noVocab')}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-gray-700/50 bg-gray-900/50 flex justify-end gap-3 flex-shrink-0 flex-wrap">
                    <button onClick={onClose} className="px-6 py-2 rounded-xl text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors font-medium">
                        {t('explore.preview.closeButton')}
                    </button>
                    
                    {isMyShare && songData && (
                        <>
                            <button 
                                onClick={() => onDeleteCommunity(communitySong.id)} 
                                className="px-4 py-2 rounded-xl text-red-100 bg-red-900/50 border border-red-800 hover:bg-red-800 transition-colors font-medium shadow-sm flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                {t('explore.preview.deleteCommunityButton')}
                            </button>
                            <button 
                                onClick={() => onUpdateCommunity(songData, wordsData)} 
                                className="px-4 py-2 rounded-xl text-orange-100 bg-orange-600/80 hover:bg-orange-500 transition-colors font-bold shadow-md flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                {t('explore.preview.updateCommunityButton')}
                            </button>
                        </>
                    )}

                    <button 
                        onClick={() => songData && onImport(songData, wordsData)} 
                        disabled={isLoading || !songData}
                        className="px-8 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 transition-colors font-bold shadow-md"
                    >
                        {t('home.importButton')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SongPreviewModal;
