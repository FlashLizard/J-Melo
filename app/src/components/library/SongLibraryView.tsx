// src/components/library/SongLibraryView.tsx
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { SongRecord } from '@/lib/db';
import cn from 'classnames';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');

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
            {/* Unified Top Bar: Search, Search Icon Button, and Mode Toggle */}
            <div className="mb-8 flex flex-row items-center gap-2 sm:gap-3 max-w-5xl mx-auto">
                <div className="relative flex-grow min-w-0">
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
                    className="p-2.5 sm:p-3 bg-indigo-600/90 rounded-xl sm:rounded-2xl hover:bg-indigo-500 text-white transition-all border border-indigo-500/30 shadow-md active:scale-95 shrink-0"
                    title={t('index.searchButton')}
                >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
                
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

            {filteredSongs.length === 0 ? (
                <div className="text-center py-20 bg-gray-800/30 rounded-3xl border border-gray-700/30 border-dashed max-w-2xl mx-auto">
                    <div className="bg-gray-900/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    </div>
                    <p className="text-xl text-gray-300 font-medium mb-2">{t('home.noSongsFound')}</p>
                    <p className="text-gray-500 text-sm">{t('home.addSongsHint')}</p>
                </div>
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
                                "group relative bg-gray-800 rounded-2xl overflow-hidden border transition-all duration-300 select-none",
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
                                                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10 shadow-sm" title="Audio Cached Offline">
                                                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            )}

                                            <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300 ease-out">
                                                <h2 className="text-base font-bold text-white leading-tight mb-1 line-clamp-2 drop-shadow-md">{song.title}</h2>
                                                <p className="text-xs text-gray-300 truncate drop-shadow">{song.artist || t('home.unknownArtist')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="flex flex-col gap-2 max-w-5xl mx-auto">
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
                                    "flex items-center gap-4 p-3 rounded-2xl bg-gray-800/40 border transition-all duration-200 select-none cursor-pointer group",
                                    isSelected ? "border-indigo-500 bg-indigo-500/10" : "border-gray-700/50 hover:bg-gray-800/60 hover:border-gray-600"
                                )}
                                style={{ WebkitTouchCallout: 'none' }}
                            >
                                <div className="w-14 h-14 rounded-xl bg-gray-700 overflow-hidden flex-shrink-0 shadow-inner">
                                    {song.cover_url ? (
                                        <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
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
                                <div className="flex items-center gap-3 shrink-0 pr-2">
                                    {song.is_cached && (
                                        <div className="bg-green-500/20 p-1.5 rounded-lg border border-green-500/20" title="Audio Cached Offline">
                                            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                    )}
                                    {/* Permanent checkbox in list mode */}
                                    <div 
                                        className={cn(
                                            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
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
                                        {isSelected && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
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
