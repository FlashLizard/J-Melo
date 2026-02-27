// src/components/player/PlayerControls.tsx
import React, { useState, useRef } from 'react';
import usePlayerStore, { playerStoreActions } from '@/stores/usePlayerStore';
import cn from 'classnames';

// A simple set of SVG icons for the controls
const PauseIcon = () => (
  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M4.516 3.87A1.5 1.5 0 0 1 7.5 5.066v9.868a1.5 1.5 0 0 1-2.984.996L4.516 3.87zM12.5 5.066a1.5 1.5 0 0 1 2.984-.996l.001 12.06a1.5 1.5 0 0 1-2.985-.996V5.066z"></path></svg>
);
const PlayIcon = () => (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M15.84 8.747a1.5 1.5 0 0 1 0 2.506l-8.25 4.95A1.5 1.5 0 0 1 5.25 15V5a1.5 1.5 0 0 1 2.34-1.253l8.25 4.95z"></path></svg>
);

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
  const { loopA, loopB } = usePlayerStore();

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
    <div className="p-6 bg-gray-800 text-white flex flex-col items-center rounded-t-3xl shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.5)]">
      
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
      <div className="flex items-center justify-center space-x-6 w-full">
        <div className="w-16 flex justify-end">
            <button
              onClick={playerStoreActions.setLoopA}
              className={cn('text-xs font-bold px-4 py-2 rounded-full transition-colors border', {
                'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]': loopA !== null,
                'bg-transparent border-gray-600 text-gray-400 hover:text-white hover:border-gray-400': loopA === null,
              })}
            >
              A
            </button>
        </div>
        
        <button
          onClick={playerStoreActions.togglePlay}
          className="p-4 rounded-full bg-white hover:bg-gray-200 text-indigo-600 shadow-lg transform hover:scale-105 transition-all flex-shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="w-16 flex justify-start">
            <button
              onClick={loopA !== null && loopB !== null ? playerStoreActions.clearLoop : playerStoreActions.setLoopB}
              disabled={loopA === null}
              className={cn('text-xs font-bold px-4 py-2 rounded-full transition-all border', {
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
    </div>
  );
};

export default PlayerControls;
