// src/components/lyrics/ProgressHighlighter.tsx
import React, { useState, useEffect, useRef } from 'react';
import usePlayerStore from '@/stores/usePlayerStore';

interface Props {
  surface: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
  isHovered: boolean;
}

const ProgressHighlighter: React.FC<Props> = ({ surface, startTime, endTime, isActive, isHovered }) => {
  const [width, setWidth] = useState(0);
  const animationFrameId = useRef<number>(0);
  const animationStartTimestamp = useRef<number>(0);

  useEffect(() => {
    const wordDuration = (endTime - startTime) * 1000; // in milliseconds

    const animate = (timestamp: number) => {
      if (animationStartTimestamp.current === undefined) {
        animationStartTimestamp.current = timestamp;
      }
      
      const elapsed = timestamp - animationStartTimestamp.current;
      const progress = Math.min(1, elapsed / wordDuration);
      
      setWidth(progress * 100);

      if (progress < 1) {
        animationFrameId.current = requestAnimationFrame(animate);
      }
    };

    if (isActive) {
      // Correctly handle starting animation midway through a word
      const initialPlayerTime = usePlayerStore.getState().currentTime;
      const initialOffset = (initialPlayerTime - startTime) * 1000;
      animationStartTimestamp.current = performance.now() - initialOffset;

      animationFrameId.current = requestAnimationFrame(animate);
    } else {
      // Reset when not active
      setWidth(0);
      animationStartTimestamp.current = undefined;
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isActive, startTime, endTime]);

  const highlightColor = isHovered ? 'text-yellow-300' : 'text-green-400';
  const baseColor = isHovered ? 'text-yellow-300' : 'text-white';

  return (
    <span className={`relative block text-lg ${baseColor}`}>
      <span>{surface}</span>
      <span
        className={`absolute top-0 left-0 h-full overflow-hidden whitespace-nowrap ${highlightColor}`}
        style={{ width: `${width}%` }}
      >
        {surface}
      </span>
    </span>
  );
};

export default ProgressHighlighter;

