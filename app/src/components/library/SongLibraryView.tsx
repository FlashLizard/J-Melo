// src/components/library/SongLibraryView.tsx
import React, { useMemo, useState } from 'react';
import cn from 'classnames';
import useSettingsStore from '@/stores/useSettingsStore';
import EmptyState from '@/components/common/EmptyState';
import SearchDisplayToolbar, { DisplayMode } from '@/components/common/SearchDisplayToolbar';

interface DisplaySongData {
  id?: number;
  title: string;
  artist: string | null;
  cover_url?: string | null;
  is_cached?: boolean;
}

interface SongLibraryViewProps {
    songs: DisplaySongData[];
    isSelectMode: boolean;
    selectedSongIds: number[];
    onPointerDown: (e: React.PointerEvent, id: number) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUpOrLeave: () => void;
    handleCardAction: (id: number) => void;
    handleSelectSong: (id: number) => void;
    setIsSelectMode: (val: boolean) => void;
    t: (key: string) => string;
}

const SongLibraryView: React.FC<SongLibraryViewProps> = ({ 
    songs, isSelectMode, selectedSongIds, 
    onPointerDown, onPointerMove, onPointerUpOrLeave, handleCardAction, 
    handleSelectSong, setIsSelectMode, t 
}) => {
    const { settings, updateSetting } = useSettingsStore();
    const [searchQuery, setSearchQuery] = useState('');
    
    const displayMode = settings.libraryDisplayMode || 'grid';
    const setDisplayMode = (mode: DisplayMode) => updateSetting('libraryDisplayMode', mode);

    const filteredSongs = useMemo(() => {
        if (!searchQuery.trim()) return songs;
        const q = searchQuery.toLowerCase();
        return songs.filter(s => 
            s.title.toLowerCase().includes(q) || 
            (s.artist && s.artist.toLowerCase().includes(q))
        );
    }, [songs, searchQuery]);

    return (
        <div className="animate-in fade-in duration-500">
            <SearchDisplayToolbar
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onSubmit={() => undefined}
                placeholder={t('explore.searchPlaceholder')}
                searchLabel={t('index.searchButton')}
                clearLabel={t('common.clearSearch') || 'Clear search'}
                displayMode={displayMode}
                onDisplayModeChange={setDisplayMode}
                displayModeLabel={t('common.displayMode')}
                gridLabel={t('common.gridMode')}
                listLabel={t('common.listMode')}
            />

            {filteredSongs.length === 0 ? (
                <EmptyState title={t('home.noSongsFound')} description={t('home.addSongsHint')} icon={searchQuery ? 'search' : 'music'} />
            ) : displayMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                    {filteredSongs.map((song) => {
                        const songId = song.id as number;
                        const isSelected = selectedSongIds.includes(songId);
                        
                        return (
                            <div 
                                key={songId} 
                                onPointerDown={(e) => onPointerDown(e, songId)}
                                onPointerMove={onPointerMove}
                                onPointerUp={onPointerUpOrLeave}
                                onPointerLeave={onPointerUpOrLeave}
                                className={cn(
                                "group relative bg-gray-800 rounded-2xl overflow-hidden border transition-all duration-300 select-none shadow-md",
                                isSelectMode ? "cursor-pointer" : "md:hover:-translate-y-1.5 md:hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.5)]",
                                isSelected ? "border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.5)] ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#0f172a]" : "border-gray-700/50 md:hover:border-gray-600"
                            )}
                            style={{ WebkitTouchCallout: 'none' }}
                            >
                                <div onClick={() => handleCardAction(songId)} className="h-full cursor-pointer">
                                    <div className={cn("transition-all duration-200 h-full", isSelected ? 'opacity-50 scale-95' : '')}>
                                        <div className="relative aspect-square bg-gray-700 overflow-hidden flex-shrink-0">
                                            {song.cover_url ? (
                                                <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-500 ease-out" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800 text-gray-500">
                                                    <svg className="w-12 h-12 opacity-50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300"></div>
                                            
                                            {song.is_cached && (
                                                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10 shadow-sm" title={t('toolPanel.audioCached')}>
                                                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            )}

                                            <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300 ease-out">
                                                <h2 className="text-sm sm:text-base font-bold text-white leading-tight mb-1 line-clamp-2 drop-shadow-md">{song.title}</h2>
                                                <p className="text-[10px] sm:text-xs text-gray-300 truncate drop-shadow">{song.artist || t('home.unknownArtist')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="flex flex-col gap-2 max-w-5xl mx-auto w-full">
                    {filteredSongs.map((song) => {
                        const songId = song.id as number;
                        const isSelected = selectedSongIds.includes(songId);
                        return (
                            <div 
                                key={songId}
                                onPointerDown={(e) => onPointerDown(e, songId)}
                                onPointerMove={onPointerMove}
                                onPointerUp={onPointerUpOrLeave}
                                onPointerLeave={onPointerUpOrLeave}
                                onClick={() => handleCardAction(songId)}
                                className={cn(
                                    "flex items-center gap-3 sm:gap-4 p-2 sm:p-3 rounded-2xl bg-gray-800/40 border transition-all duration-200 select-none cursor-pointer group shadow-sm w-full overflow-hidden",
                                    isSelected ? "border-indigo-500 bg-indigo-500/10" : "border-gray-700/50 hover:bg-gray-800/60 hover:border-gray-600"
                                )}
                                style={{ WebkitTouchCallout: 'none' }}
                            >
                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gray-700 overflow-hidden flex-shrink-0 shadow-inner">
                                    {song.cover_url ? (
                                        <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
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
                                <div className="flex items-center gap-2 sm:gap-3 shrink-0 pr-1 sm:pr-2">
                                    {song.is_cached && (
                                        <div className="bg-green-500/20 p-1 sm:p-1.5 rounded-lg border border-green-500/20" title={t('toolPanel.audioCached')}>
                                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                    )}
                                    <div 
                                        className={cn(
                                            "w-5 h-5 sm:w-6 sm:h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                            isSelected ? "bg-indigo-600 border-indigo-500" : "bg-gray-900/50 border-gray-600"
                                        )}
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            if (!isSelectMode) {
                                                setIsSelectMode(true);
                                            }
                                            handleSelectSong(songId);
                                        }}
                                    >
                                        {isSelected && <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

export default SongLibraryView;
