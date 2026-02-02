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
  const animationFrameId = useRef<number>();

  useEffect(() => {
    const animate = () => {
      const { currentTime } = usePlayerStore.getState();
      const duration = endTime - startTime;

      if (currentTime >= startTime && currentTime <= endTime) {
        const progress = (currentTime - startTime) / duration;
        setWidth(progress * 100);
        animationFrameId.current = requestAnimationFrame(animate);
      } else {
        // Ensure it completes or resets
        setWidth(currentTime > endTime ? 100 : 0);
      }
    };

    if (isActive) {
      animationFrameId.current = requestAnimationFrame(animate);
    } else {
      setWidth(0);
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
      {/* Base text */}
      <span>{surface}</span>

      {/* Highlighted text overlay */}
      <span
        className={`absolute top-0 left-0 h-full overflow-hidden ${highlightColor}`}
        style={{ width: `${width}%` }}
      >
        {surface}
      </span>
    </span>
  );
};

export default ProgressHighlighter;
