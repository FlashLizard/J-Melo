// src/components/player/PlayerControls.tsx
import React from 'react';
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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    playerStoreActions.seek(Number(e.target.value));
  };

  return (
    <div className="p-4 bg-gray-900 text-white flex flex-col items-center">
      <div className="flex items-center space-x-4">
        <button
          onClick={playerStoreActions.setLoopA}
          className={cn('text-sm font-bold px-3 py-1 rounded', {
            'bg-blue-500 text-white': loopA !== null,
            'bg-gray-700': loopA === null,
          })}
        >
          A {loopA !== null && `(${formatTime(loopA)})`}
        </button>
        <button
          onClick={playerStoreActions.setLoopB}
          disabled={loopA === null}
          className={cn('text-sm font-bold px-3 py-1 rounded', {
            'bg-blue-500 text-white': loopB !== null,
            'bg-gray-700': loopB === null,
            'opacity-50 cursor-not-allowed': loopA === null,
          })}
        >
          B {loopB !== null && `(${formatTime(loopB)})`}
        </button>

        <button
          onClick={playerStoreActions.togglePlay}
          className="p-2 rounded-full bg-green-500 hover:bg-green-400"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          onClick={playerStoreActions.clearLoop}
          className="text-sm font-bold px-3 py-1 rounded bg-red-600 hover:bg-red-500"
        >
          Clear
        </button>
      </div>
      <div className="w-full mt-2">
        <div className="flex justify-between text-xs">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <input
          type="range"
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
        />
      </div>
    </div>
  );
};

export default PlayerControls;
