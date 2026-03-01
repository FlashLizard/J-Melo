// src/components/library/SongLibraryView.tsx
import React, { useMemo } from 'react';
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
    t: (key: string) => string;
}

const SongLibraryView: React.FC<SongLibraryViewProps> = ({ 
    songs, isSelectMode, selectedSongIds, 
    onPointerDown, onPointerMove, onPointerUpOrLeave, handleCardAction, t 
}) => {
    return (
        <div className="animate-in fade-in duration-500">
            {songs.length === 0 ? (
                <div className="text-center py-20 bg-gray-800/30 rounded-3xl border border-gray-700/30 border-dashed max-w-2xl mx-auto">
                    <div className="bg-gray-900/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    </div>
                    <p className="text-xl text-gray-300 font-medium mb-2">{t('home.noSongsFound')}</p>
                    <p className="text-gray-500 text-sm">{t('home.addSongsHint')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                    {songs.map((song) => {
                        const songId = song.id as number;
                        const isSelected = selectedSongIds.includes(songId);
                        
                        const CardContent = () => (
                            <div className="relative aspect-square bg-gray-700 overflow-hidden flex-shrink-0">
                                {song.cover_url ? (
                                    <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" />
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
                        );

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
                                    <div className={cn("transition-all duration-200 h-full", isSelected ? 'opacity-50 scale-95 rounded-2xl overflow-hidden' : '')}>
                                        <CardContent />
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
