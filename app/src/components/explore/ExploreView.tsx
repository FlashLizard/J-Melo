// src/components/explore/ExploreView.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useTranslation from '@/hooks/useTranslation';
import useSongStore from '@/stores/useSongStore';
import { db, blobToBase64 } from '@/lib/db';
import ImportConflictModal, { Conflict } from '@/components/common/ImportConflictModal';
import { SongRecord, WordRecord } from '@/lib/db';
import SongPreviewModal from '@/components/explore/SongPreviewModal';
import useSettingsStore from '@/stores/useSettingsStore';
import toast from 'react-hot-toast';
import cn from 'classnames';
import { buildApiUrl, deleteJson, getJson, postJson } from '@/lib/backendClient';
import { ensureBackendMediaCache } from '@/lib/mediaCache';
import EmptyState from '@/components/common/EmptyState';
import SearchDisplayToolbar, { DisplayMode } from '@/components/common/SearchDisplayToolbar';

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

interface ExploreViewProps {
    onImportSuccess?: () => void;
}

const ExploreView: React.FC<ExploreViewProps> = ({ onImportSuccess }) => {
    const { t } = useTranslation();
    const { settings, loadSettings, updateSetting } = useSettingsStore();
    const [songs, setSongs] = useState<CommunitySong[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importState, setImportState] = useState<ImportState | null>(null);
    const [previewSong, setPreviewSong] = useState<CommunitySong | null>(null);

    const displayMode = settings.exploreDisplayMode || 'grid';
    const setDisplayMode = (mode: DisplayMode) => updateSetting('exploreDisplayMode', mode);

    const backendUrl = settings.backendUrl;
    const myNickname = settings.sharerNickname;

    const fetchSongs = useCallback(async (query: string = '') => {
        if (!backendUrl) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await getJson<{ songs: CommunitySong[] }>(
                backendUrl,
                '/api/community/songs',
                query ? { q: query } : undefined
            );
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

    const handleSearch = () => {
        fetchSongs(searchQuery);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        fetchSongs();
    };

    const handleImport = async (songData: SongRecord, wordsData: WordRecord[]) => {
        try {
            const cacheResult = await ensureBackendMediaCache(backendUrl, songData);
            if (!cacheResult.available) {
                throw new Error(t('explore.audioUnavailable'));
            }
            const importSong = cacheResult.song;
            const allExistingSongs = await db.songs.toArray();
            const existingUrlMap = new Map(allExistingSongs.map(s => [s.sourceUrl, s]));

            const foundConflicts: Conflict[] = [];
            const newSongs: SongRecord[] = [];

            const existingSong = existingUrlMap.get(importSong.sourceUrl);
            if (existingSong) {
                foundConflicts.push({ existingSong, importedSong: importSong });
            } else {
                newSongs.push(importSong);
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
                toast.success(t('settings.importSuccess'));
                setPreviewSong(null);
                if (onImportSuccess) onImportSuccess();
            }
        } catch (e) {
            toast.error(t('explore.downloadError', { error: (e as Error).message }));
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

            await deleteJson(backendUrl, `/api/community/songs/${previewSong.id}`, { sharer_name: myNickname });

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

            await postJson(backendUrl, '/api/community/share', payload);

            toast.success(t('explore.communityVersionUpdated'));
            setPreviewSong(null);
            fetchSongs(searchQuery);
        } catch (e) {
            toast.error(`Update failed: ${(e as Error).message}`);
        }
    };

    const handleDeleteCommunity = async (songId: number) => {
        if (!myNickname) return;
        if (!window.confirm(t('toolPanel.communityDeleteConfirm'))) return;
        try {
            await deleteJson(backendUrl, `/api/community/songs/${songId}`, { sharer_name: myNickname });
            
            toast.success(t('myShared.deleteSuccess'));
            setPreviewSong(null);
            fetchSongs(searchQuery);
        } catch (e) {
            toast.error(t('myShared.deleteError', { error: (e as Error).message }));
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
                    onImportComplete={() => {
                        setImportState(null);
                        toast.success(t('settings.importSuccess'));
                        if (onImportSuccess) onImportSuccess();
                    }}
                />
            )}

            <SearchDisplayToolbar
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onSubmit={handleSearch}
                onClear={handleClearSearch}
                placeholder={t('explore.searchPlaceholder')}
                searchLabel={t('explore.searchButton')}
                clearLabel={t('common.clearSearch') || 'Clear search'}
                displayMode={displayMode}
                onDisplayModeChange={setDisplayMode}
                displayModeLabel={t('common.displayMode')}
                gridLabel={t('common.gridMode')}
                listLabel={t('common.listMode')}
                isLoading={isLoading}
            />

            {error && (
                <div className="bg-red-900/40 border border-red-800 p-4 rounded-2xl mb-8 text-center text-red-200 shadow-sm">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <svg className="animate-spin h-10 w-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <p className="text-gray-400 font-medium tracking-wide animate-pulse">{t('home.loadingSongs')}</p>
                </div>
            ) : songs.length === 0 ? (
                <EmptyState title={t('explore.noSongsFound')} icon={searchQuery ? 'search' : 'music'} />
            ) : displayMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                    {songs.map((song) => (
                        <div 
                            key={song.id} 
                            className="group relative bg-gray-800 rounded-2xl overflow-hidden border border-gray-700/50 md:hover:border-gray-600 transition-all duration-300 md:hover:-translate-y-1.5 md:hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.5)] cursor-pointer select-none shadow-md" 
                            onClick={() => setPreviewSong(song)}
                            style={{ WebkitTouchCallout: 'none' }}
                        >
                            <div className="relative aspect-square bg-gray-700 overflow-hidden">
                                {song.cover_url ? (
                                    <img
                                        src={song.cover_url.startsWith('/') ? buildApiUrl(backendUrl, song.cover_url) : buildApiUrl(backendUrl, '/api/media/proxy-image', { url: song.cover_url })}
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
                                    <h2 className="text-sm font-bold text-white leading-tight mb-1 line-clamp-2 drop-shadow-md" title={song.title}>{song.title}</h2>
                                    <p className="text-[10px] text-gray-300 truncate drop-shadow mb-2" title={song.artist}>{song.artist || t('home.unknownArtist')}</p>
                                    <div className="flex justify-between items-center pt-2 border-t border-gray-600/50 text-[9px] text-gray-400 font-medium">
                                        <span className="flex items-center gap-1"><svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>{song.sharer_name}</span>
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
                            className="flex items-center gap-3 sm:gap-4 p-2 sm:p-3 rounded-2xl bg-gray-800/40 border border-gray-700/50 hover:bg-gray-800/60 hover:border-gray-600 transition-all duration-200 select-none cursor-pointer group w-full overflow-hidden"
                            style={{ WebkitTouchCallout: 'none' }}
                        >
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gray-700 overflow-hidden flex-shrink-0 shadow-inner">
                                {song.cover_url ? (
                                    <img
                                        src={song.cover_url.startsWith('/') ? buildApiUrl(backendUrl, song.cover_url) : buildApiUrl(backendUrl, '/api/media/proxy-image', { url: song.cover_url })}
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
                                <h3 className="font-bold text-white text-sm sm:text-base truncate">{song.title}</h3>
                                <p className="text-xs sm:text-sm text-gray-400 truncate">{song.artist || t('home.unknownArtist')}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0 pr-1 sm:pr-2">
                                <span className="text-[9px] sm:text-[10px] font-bold text-indigo-400 bg-indigo-900/20 px-1.5 sm:px-2 py-0.5 rounded border border-indigo-800/30 truncate max-w-[80px] sm:max-w-none text-center">{song.sharer_name}</span>
                                <span className="hidden sm:inline text-[9px] text-gray-500 font-mono">{new Date(song.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ExploreView;
