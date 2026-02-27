// src/components/lyrics/ProgressHighlighter.tsx
import React, { useMemo } from 'react';
import cn from 'classnames';

interface Props {
  surface: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
  isHovered: boolean;
  fontSizeMultiplier?: number;
  currentTime: number; // Receive currentTime explicitly
}

const ProgressHighlighter: React.FC<Props> = ({ surface, startTime, endTime, isActive, isHovered, fontSizeMultiplier = 1.0, currentTime }) => {

  const progress = useMemo(() => {
    if (!isActive) return 0;
    const duration = endTime - startTime;
    if (duration <= 0) return 100;
    const currentProgress = ((currentTime - startTime) / duration) * 100;
    return Math.min(Math.max(currentProgress, 0), 100);
  }, [currentTime, startTime, endTime, isActive]);

  return (
    <span 
        className={cn('relative block leading-tight', { 'text-yellow-300': isHovered, 'text-white': !isHovered })}
        style={{ fontSize: `${1.125 * fontSizeMultiplier}rem` }}
    >
      {/* Base text: Matches the rest of the line's color (white) */}
      <span className="whitespace-pre">{surface}</span>
      
      {/* Highlighted text overlay: Paints over the base text from left to right */}
      {isActive && !isHovered && (
        <span 
          className="absolute left-0 top-0 text-green-400 whitespace-pre pointer-events-none"
          style={{ 
              clipPath: `inset(0 ${100 - progress}% 0 0)`,
          }}
        >
          {surface}
        </span>
      )}
    </span>
  );
};

export default ProgressHighlighter;
