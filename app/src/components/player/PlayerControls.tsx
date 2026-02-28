// src/components/player/PlayerControls.tsx
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import usePlayerStore, { playerStoreActions } from '@/stores/usePlayerStore';
import cn from 'classnames';
import { useRouter } from 'next/router';
import { SongRecord } from '@/lib/db';

// A simple set of SVG icons for the controls
const PauseIcon = () => (
  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M4.516 3.87A1.5 1.5 0 0 1 7.5 5.066v9.868a1.5 1.5 0 0 1-2.984.996L4.516 3.87zM12.5 5.066a1.5 1.5 0 0 1 2.984-.996l.001 12.06a1.5 1.5 0 0 1-2.985-.996V5.066z"></path></svg>
);
const PlayIcon = () => (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M15.84 8.747a1.5 1.5 0 0 1 0 2.506l-8.25 4.95A1.5 1.5 0 0 1 5.25 15V5a1.5 1.5 0 0 1 2.34-1.253l8.25 4.95z"></path></svg>
);

const SequentialIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 21l3-3-3-3" /></svg>;
const ShuffleIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 16l4-4-4-4M8 8l-4 4 4 4" /></svg>; // Actually a cross/shuffle icon is better, let's use a simpler one
const RealShuffleIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>;
const LoopIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;

const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
};

const PlayerControls: React.FC = () => {
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const { loopA, loopB, playMode } = usePlayerStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allSongs, setAllSongs] = useState<SongRecord[]>([]);
  const router = useRouter();

  useEffect(() => {
      if (isModalOpen) {
          import('@/lib/db').then(({ db }) => {
              db.songs.toArray().then(setAllSongs);
          });
      }
  }, [isModalOpen]);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  const displayTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;
  
  const loopAPercent = duration > 0 && loopA !== null ? (loopA / duration) * 100 : null;
  const loopBPercent = duration > 0 && loopB !== null ? (loopB / duration) * 100 : null;

  const updateProgressFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    const percentage = x / rect.width;
    setDragTime(percentage * duration);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    setIsDragging(true);
    updateProgressFromEvent(e);
    progressBarRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateProgressFromEvent(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !progressBarRef.current) return;
    setIsDragging(false);
    playerStoreActions.seek(dragTime);
    progressBarRef.current.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="p-6 bg-gray-800 text-white flex flex-col items-center rounded-t-3xl shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.5)] z-20">
      
      {/* Custom Progress Bar */}
      <div className="w-full mb-6 relative px-2">
        <div 
            ref={progressBarRef}
            className="w-full h-8 flex items-center cursor-pointer group touch-none absolute top-1/2 left-0 -translate-y-1/2 z-10"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div className="w-full h-1.5 bg-gray-600 rounded-full overflow-hidden relative">
                {/* Loop Range Highlight */}
                {loopAPercent !== null && loopBPercent !== null && (
                    <div 
                        className="absolute h-full bg-blue-500/40"
                        style={{ left: `${loopAPercent}%`, width: `${loopBPercent - loopAPercent}%` }}
                    ></div>
                )}
                <div 
                    className="h-full bg-green-500 rounded-full transition-none relative"
                    style={{ width: `${progressPercent}%` }}
                >
                </div>
            </div>
            
            {/* Draggable Thumb */}
            <div 
                className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg transform -translate-x-1/2",
                    isDragging ? "scale-125 opacity-100" : "scale-100 opacity-0 group-hover:opacity-100 transition-all duration-200"
                )}
                style={{ left: `${progressPercent}%` }}
            ></div>
            
            {/* Loop Markers */}
            {loopAPercent !== null && (
                <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 bg-blue-400 rounded-full transform -translate-x-1/2" style={{ left: `${loopAPercent}%` }}></div>
            )}
            {loopBPercent !== null && (
                <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 bg-blue-400 rounded-full transform -translate-x-1/2" style={{ left: `${loopBPercent}%` }}></div>
            )}
        </div>
        
        {/* Invisible spacer for the absolute bar */}
        <div className="h-4"></div>
        
        <div className="flex justify-between text-xs text-gray-400 mt-1 font-mono tracking-wider px-1">
          <span>{formatTime(displayTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between w-full max-w-sm px-2">
        {/* Playback Mode */}
        <button 
            onClick={playerStoreActions.togglePlayMode}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title={`Mode: ${playMode}`}
        >
            {playMode === 'sequential' && <SequentialIcon />}
            {playMode === 'shuffle' && <RealShuffleIcon />}
            {playMode === 'loop-single' && <LoopIcon />}
        </button>

        {/* Playback Actions */}
        <div className="flex items-center space-x-4">
            <div className="w-12 flex justify-end">
                <button
                onClick={playerStoreActions.setLoopA}
                className={cn('text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors border', {
                    'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]': loopA !== null,
                    'bg-transparent border-gray-600 text-gray-400 hover:text-white hover:border-gray-400': loopA === null,
                })}
                >
                A
                </button>
            </div>
            
            <button
            onClick={playerStoreActions.togglePlay}
            className="p-4 rounded-full bg-white hover:bg-gray-200 text-indigo-600 shadow-lg transform hover:scale-105 active:scale-95 transition-all flex-shrink-0"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            <div className="w-12 flex justify-start">
                <button
                onClick={loopA !== null && loopB !== null ? playerStoreActions.clearLoop : playerStoreActions.setLoopB}
                disabled={loopA === null}
                className={cn('text-[10px] font-bold px-3 py-1.5 rounded-full transition-all border', {
                    'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]': loopB !== null && loopA !== null,
                    'bg-transparent border-gray-600 text-gray-400 hover:text-white hover:border-gray-400': loopB === null && loopA !== null,
                    'bg-transparent border-gray-700 text-gray-600 cursor-not-allowed': loopA === null,
                    'bg-red-600 border-red-500 text-white hover:bg-red-500': loopA !== null && loopB !== null // Becomes clear button
                })}
                >
                {loopA !== null && loopB !== null ? 'CLR' : 'B'}
                </button>
            </div>
        </div>

        {/* Quick Select Modal Toggle */}
        <button 
            onClick={() => setIsModalOpen(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Quick Select Song"
        >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>

      {/* Quick Select Modal */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 sm:p-6" style={{ margin: 0, padding: '16px' }}>
              <div className="bg-gray-800 border border-gray-700 w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-5 border-b border-gray-700/50 bg-gray-800/90 z-10">
                      <h2 className="text-xl font-bold text-white tracking-wide">Quick Select</h2>
                      <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
                  <div className="flex-grow overflow-y-auto p-4 space-y-2 custom-scrollbar">
                      {allSongs.map(s => (
                          <div 
                            key={s.id} 
                            onClick={() => {
                                router.push(`/player/${s.id}`);
                                setIsModalOpen(false);
                            }}
                            className={cn(
                                "p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-4 group",
                                Number(router.query.songId) === s.id 
                                    ? "bg-green-900/20 border-green-500/50 shadow-sm" 
                                    : "bg-gray-800/50 border-gray-700 hover:bg-gray-700/80 hover:border-gray-600"
                            )}
                          >
                            <div className="w-12 h-12 rounded-lg bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-inner">
                                {s.coverImageData ? (
                                    <img src={URL.createObjectURL(s.coverImageData)} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                ) : (
                                    <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                                )}
                            </div>
                            <div className="flex-grow min-w-0 pr-2">
                                <h4 className={cn("font-bold truncate text-base", Number(router.query.songId) === s.id ? "text-green-400" : "text-gray-100 group-hover:text-white")}>{s.title}</h4>
                                <p className="text-xs text-gray-400 truncate mt-0.5">{s.artist || 'Unknown Artist'}</p>
                            </div>
                            {Number(router.query.songId) === s.id && (
                                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8">
                                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                </div>
                            )}
                          </div>
                      ))}
                  </div>
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};

export default PlayerControls;
