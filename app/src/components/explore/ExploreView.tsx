// src/components/explore/ExploreView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import useTranslation from '@/hooks/useTranslation';
import useSongStore from '@/stores/useSongStore';
import { db, blobToBase64 } from '@/lib/db';
import ImportConflictModal, { Conflict } from '@/components/common/ImportConflictModal';
import { SongRecord, WordRecord } from '@/lib/db';
import SongPreviewModal from '@/components/explore/SongPreviewModal';
import cn from 'classnames';
import useSettingsStore from '@/stores/useSettingsStore';

interface CommunitySong {
    id: number;
    title: string;
    artist: string;
    cover_url: string;
    sharer_name: string;
    created_at: string;
}

interface ImportState {
  conflicts: Conflict[];
  nonConflictingSongs: SongRecord[];
  importedWords: WordRecord[];
}

const ExploreView: React.FC = () => {
    const { t } = useTranslation();
    const { settings, loadSettings } = useSettingsStore();
    const [songs, setSongs] = useState<CommunitySong[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importState, setImportState] = useState<ImportState | null>(null);
    const [previewSong, setPreviewSong] = useState<CommunitySong | null>(null);
    const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');

    const backendUrl = settings.backendUrl;
    const myNickname = settings.sharerNickname;

    const fetchSongs = useCallback(async (query: string = '') => {
        if (!backendUrl) return;
        setIsLoading(true);
        setError(null);
        try {
            const url = new URL(`${backendUrl}/api/community/songs`);
            if (query) url.searchParams.append('q', query);
            const res = await fetch(url.toString());
            if (!res.ok) throw new Error('Failed to fetch community songs');
            const data = await res.json();
            setSongs(data.songs);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [backendUrl]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    useEffect(() => {
        if (backendUrl) {
            fetchSongs();
        }
    }, [backendUrl, fetchSongs]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchSongs(searchQuery);
    };

    const handleImport = async (songData: SongRecord, wordsData: WordRecord[]) => {
        try {
            const allExistingSongs = await db.songs.toArray();
            const existingUrlMap = new Map(allExistingSongs.map(s => [s.sourceUrl, s]));

            const foundConflicts: Conflict[] = [];
            const newSongs: SongRecord[] = [];

            const existingSong = existingUrlMap.get(songData.sourceUrl);
            if (existingSong) {
                foundConflicts.push({ existingSong, importedSong: songData });
            } else {
                newSongs.push(songData);
            }

            if (foundConflicts.length > 0) {
                setImportState({ 
                    conflicts: foundConflicts, 
                    nonConflictingSongs: newSongs, 
                    importedWords: wordsData 
                });
                setPreviewSong(null);
            } else {
                const { addManySongs } = useSongStore.getState();
                await addManySongs(newSongs, wordsData);
                setPreviewSong(null);
            }
        } catch (e) {
            alert(t('explore.downloadError', { error: (e as Error).message }));
        }
    };

    const handleUpdateCommunity = async (remoteSongData: SongRecord, wordsData: WordRecord[]) => {
        if (!previewSong || !myNickname) return;
        if (!window.confirm(t('toolPanel.communityUpdateConfirm'))) return;

        try {
            const localSongs = await db.songs.where('sourceUrl').equals(remoteSongData.sourceUrl).toArray();
            if (localSongs.length === 0) {
                throw new Error("Could not find this song in your local library. Please import it first.");
            }
            const localSong = localSongs[0];
            const localWords = await db.words.where('sourceSongId').equals(localSong.id!).toArray();

            const delRes = await fetch(`${backendUrl}/api/community/songs/${previewSong.id}?sharer_name=${encodeURIComponent(myNickname)}`, {
                method: 'DELETE'
            });
            if (!delRes.ok) throw new Error("Failed to delete old community version.");

            const { audioData, ...rest } = localSong;
            let coverImageBase64 = '';
            if (localSong.coverImageData) {
                coverImageBase64 = await blobToBase64(localSong.coverImageData);
            }
            const songPayload = { ...rest, coverImageData: coverImageBase64 };

            const payload = {
                title: localSong.title,
                artist: localSong.artist,
                cover_url: localSong.cover_url,
                sharer_name: myNickname,
                song_data: songPayload,
                words_data: localWords
            };

            const postRes = await fetch(`${backendUrl}/api/community/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!postRes.ok) throw new Error("Failed to upload new version.");

            setPreviewSong(null);
            fetchSongs(searchQuery);
        } catch (e) {
            alert(`Update failed: ${(e as Error).message}`);
        }
    };

    const handleDeleteCommunity = async (songId: number) => {
        if (!myNickname) return;
        if (!window.confirm(t('toolPanel.communityDeleteConfirm'))) return;
        try {
            const delRes = await fetch(`${backendUrl}/api/community/songs/${songId}?sharer_name=${encodeURIComponent(myNickname)}`, {
                method: 'DELETE'
            });
            if (!delRes.ok) throw new Error("Failed to delete from community server.");
            setPreviewSong(null);
            fetchSongs(searchQuery);
        } catch (e) {
            alert(t('myShared.deleteError', { error: (e as Error).message }));
        }
    };

    return (
        <div className="flex flex-col animate-in fade-in duration-500">
            {previewSong && (
                <SongPreviewModal 
                    communitySong={previewSong}
                    backendUrl={backendUrl}
                    onClose={() => setPreviewSong(null)}
                    onImport={handleImport}
                    onUpdateCommunity={handleUpdateCommunity}
                    onDeleteCommunity={handleDeleteCommunity}
                    myNickname={myNickname}
                />
            )}

            {importState && (
                <ImportConflictModal
                    isOpen={!!importState}
                    onClose={() => setImportState(null)}
                    conflicts={importState.conflicts}
                    nonConflictingSongs={importState.nonConflictingSongs}
                    importedWords={importState.importedWords}
                    onImportComplete={() => setImportState(null)}
                />
            )}

            {/* Unified Top Bar: Search Form (with Icon Button) and Mode Toggle */}
            <div className="mb-10 flex flex-row items-center gap-2 sm:gap-3 max-w-5xl mx-auto w-full">
                <form onSubmit={handleSearch} className="relative flex-grow min-w-0 flex gap-2 sm:gap-3">
                    <div className="relative flex-grow">
                        <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('explore.searchPlaceholder')}
                            className="w-full pl-9 sm:pl-12 pr-3 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-gray-800/60 border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-white text-sm sm:text-base placeholder-gray-500 shadow-inner"
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="p-2.5 sm:p-3 bg-indigo-600/90 rounded-xl sm:rounded-2xl hover:bg-indigo-500 text-white transition-all border border-indigo-500/30 shadow-md active:scale-95 shrink-0 disabled:opacity-50"
                        title={t('explore.searchButton')}
                    >
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </button>
                </form>

                <div className="flex bg-gray-800/60 p-1 rounded-xl sm:rounded-2xl border border-gray-700/50 shadow-inner shrink-0">
                    <button 
                        onClick={() => setDisplayMode('grid')}
                        className={cn("p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all", displayMode === 'grid' ? "bg-gray-700 text-indigo-400 shadow-sm" : "text-gray-500 hover:text-gray-300")}
                        title="Grid Mode"
                    >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    </button>
                    <button 
                        onClick={() => setDisplayMode('list')}
                        className={cn("p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all", displayMode === 'list' ? "bg-gray-700 text-indigo-400 shadow-sm" : "text-gray-500 hover:text-gray-300")}
                        title="List Mode"
                    >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/40 border border-red-800 p-4 rounded-2xl mb-8 text-center text-red-200">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <svg className="animate-spin h-10 w-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <p className="text-gray-400 font-medium tracking-wide animate-pulse">{t('home.loadingSongs')}</p>
                </div>
            ) : songs.length === 0 ? (
                <div className="text-center py-20 bg-gray-800/30 rounded-3xl border border-gray-700/30 border-dashed max-w-2xl mx-auto w-full">
                    <div className="bg-gray-900/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    </div>
                    <p className="text-xl text-gray-300 font-medium mb-2">{t('explore.noSongsFound')}</p>
                </div>
            ) : displayMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                    {songs.map((song) => (
                        <div 
                            key={song.id} 
                            className="group relative bg-gray-800 rounded-2xl overflow-hidden border border-gray-700/50 md:hover:border-gray-600 transition-all duration-300 md:hover:-translate-y-1.5 md:hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.5)] cursor-pointer select-none" 
                            onClick={() => setPreviewSong(song)}
                            style={{ WebkitTouchCallout: 'none' }}
                        >
                            <div className="relative aspect-square bg-gray-700 overflow-hidden">
                                {song.cover_url ? (
                                    <img 
                                        src={song.cover_url.startsWith('/') ? `${backendUrl}${song.cover_url}` : `${backendUrl}/api/media/proxy-image?url=${encodeURIComponent(song.cover_url)}`} 
                                        alt={song.title} 
                                        className="w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-500 ease-out" 
                                    />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 text-gray-500">
                                        <svg className="w-12 h-12 opacity-50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent opacity-80 md:group-hover:opacity-90 transition-opacity duration-300"></div>
                                <div className="absolute bottom-0 left-0 right-0 p-4 transform sm:translate-y-1 md:group-hover:translate-y-0 transition-transform duration-300 ease-out">
                                    <h2 className="text-base font-bold text-white leading-tight mb-1 line-clamp-2 drop-shadow-md" title={song.title}>{song.title}</h2>
                                    <p className="text-xs text-gray-300 truncate drop-shadow mb-2" title={song.artist}>{song.artist || t('home.unknownArtist')}</p>
                                    <div className="flex justify-between items-center pt-2 border-t border-gray-600/50 text-[10px] text-gray-400 font-medium">
                                        <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>{song.sharer_name}</span>
                                        <span>{new Date(song.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col gap-2 max-w-5xl mx-auto w-full">
                    {songs.map((song) => (
                        <div 
                            key={song.id}
                            onClick={() => setPreviewSong(song)}
                            className="flex items-center gap-4 p-3 rounded-2xl bg-gray-800/40 border border-gray-700/50 hover:bg-gray-800/60 hover:border-gray-600 transition-all duration-200 select-none cursor-pointer group"
                        >
                            <div className="w-14 h-14 rounded-xl bg-gray-700 overflow-hidden flex-shrink-0 shadow-inner">
                                {song.cover_url ? (
                                    <img 
                                        src={song.cover_url.startsWith('/') ? `${backendUrl}${song.cover_url}` : `${backendUrl}/api/media/proxy-image?url=${encodeURIComponent(song.cover_url)}`} 
                                        alt={song.title} 
                                        className="w-full h-full object-cover" 
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                        <svg className="w-6 h-6 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                                    </div>
                                )}
                            </div>
                            <div className="flex-grow min-w-0">
                                <h3 className="font-bold text-white truncate">{song.title}</h3>
                                <p className="text-sm text-gray-400 truncate">{song.artist || t('home.unknownArtist')}</p>
                            </div>
                            <div className="flex flex-col items-end shrink-0 pr-2 text-right">
                                <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-1 uppercase tracking-tighter">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    {song.sharer_name}
                                </span>
                                <span className="text-[10px] text-gray-500 mt-0.5">{new Date(song.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ExploreView;
