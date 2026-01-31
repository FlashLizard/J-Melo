// src/components/lyrics/LyricsDisplay.tsx
import React, { useRef, useEffect } from 'react';
import { LyricLine } from '@/lib/mock-data';
import useTutorStore from '@/stores/useTutorStore';
import cn from 'classnames';

interface Props {
  lyrics: LyricLine[];
  currentTime: number;
}

const LyricsDisplay: React.FC<Props> = ({ lyrics, currentTime }) => {
  const activeLineRef = useRef<HTMLDivElement>(null);
  const setSelectedText = useTutorStore((state) => state.actions.setSelectedText);

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentTime]);

  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-800 text-white">
      {lyrics.map((line) => {
        const isActiveLine = currentTime >= line.startTime && currentTime < line.endTime;

        return (
          <div
            key={line.id}
            ref={isActiveLine ? activeLineRef : null}
            className={cn('mb-6 transition-all duration-300', {
              'opacity-50': !isActiveLine,
              'scale-105': isActiveLine,
            })}
          >
            <p
              className="text-2xl font-semibold tracking-wider mb-2 cursor-pointer"
              onClick={() => setSelectedText(line.text)}
            >
              {line.tokens.map((token, index) => {
                const isActiveToken =
                  isActiveLine &&
                  currentTime >= token.startTime &&
                  currentTime < token.endTime;

                return (
                  <span
                    key={index}
                    className="inline-block align-bottom mr-1"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent line click event
                      setSelectedText(token.surface);
                    }}
                  >
                    <span className="text-xs text-gray-400">{token.reading}</span>
                    <span
                      className={cn('block text-lg transition-colors duration-150', {
                        'text-green-400': isActiveToken,
                        'text-white': !isActiveToken,
                      })}
                    >
                      {token.surface}
                    </span>
                  </span>
                );
              })}
            </p>
            <p className="text-sm text-gray-300">{line.translation}</p>
          </div>
        );
      })}
    </div>
  );
};

export default LyricsDisplay;
