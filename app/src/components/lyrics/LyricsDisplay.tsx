// src/components/lyrics/LyricsDisplay.tsx
import React, { useRef, useEffect, useState } from 'react';
import { LyricLine, LyricToken } from '@/interfaces/lyrics';
import { editorStoreActions } from '@/stores/useEditorStore';
import useTutorStore from '@/stores/useTutorStore';
import { playerStoreActions } from '@/stores/usePlayerStore';
import usePlayerStore from '@/stores/usePlayerStore';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useMobileViewStore from '@/stores/useMobileViewStore';
import ContextMenu, { MenuItem } from '@/components/common/ContextMenu';
import cn from 'classnames';
import ProgressHighlighter from './ProgressHighlighter';

interface Props {
  lyrics: LyricLine[];
  currentTime: number;
}

const LyricsDisplay: React.FC<Props> = ({ lyrics, currentTime }) => {
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [hoveredToken, setHoveredToken] = useState<LyricToken | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; token: LyricToken; line: LyricLine } | null>(null);
  const { setActivePanel } = useUIPanelStore();
  const { startExplanation, clearTutor } = useTutorStore();
  const { isPlaying } = usePlayerStore();
  const { setActiveView } = useMobileViewStore();

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineRef, currentTime]);

  // This is the new, more robust handler for both seeking and play/pause.
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If a context menu is open, a click should just close it.
    if (contextMenu) {
      closeContextMenu();
      return;
    }

    // Check if the click target or its parent is a word span.
    const target = e.target as HTMLElement;
    const wordSpan = target.closest('.word-span');

    if (!wordSpan) {
      // If the click was on the background, toggle play/pause.
      if (isPlaying) {
        playerStoreActions.pause();
      } else {
        playerStoreActions.play();
      }
    }
    // If it *was* on a word span, the word's own onClick will handle the seek.
  };

  const handleContextMenu = (event: React.MouseEvent, token: LyricToken, line: LyricLine) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, token, line });
  };

  const closeContextMenu = () => setContextMenu(null);

  const getMenuItems = (token: LyricToken, line: LyricLine): MenuItem[] => [
    { 
      label: '解释词语', 
      action: () => {
        startExplanation(line, token);
        setActiveView('tools');
      } 
    },
    { 
      label: '编辑句子', 
      action: () => {
        clearTutor();
        editorStoreActions.setEditingLine(line);
        setActivePanel('SENTENCE_EDITOR');
        setActiveView('tools');
      } 
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-800 text-white" onClick={handleContainerClick}>
      {lyrics.map((line) => {
        const isLineActive = currentTime >= line.startTime && currentTime < line.endTime;
        return (
          <div
            key={line.id}
            ref={isLineActive ? activeLineRef : null}
            className={cn('mb-6 transition-all duration-300 text-center', { 'opacity-50': !isLineActive, 'scale-105': isLineActive })}
          >
            <p className="text-2xl font-semibold tracking-wider mb-2">
              {line.tokens.map((token, index) => {
                const isTokenActive = isLineActive && currentTime >= token.startTime && currentTime < token.endTime;
                const hasTokenPassed = isLineActive && currentTime >= token.endTime;
                const isHovered = hoveredToken === token;

                return (
                  <span
                    key={`${token.surface}-${token.startTime}-${index}`}
                    className="word-span inline-block align-bottom mr-1 cursor-pointer" // Added 'word-span' class
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent the container's click handler from firing.
                      playerStoreActions.seek(token.startTime);
                    }}
                    onMouseEnter={() => setHoveredToken(token)}
                    onMouseLeave={() => setHoveredToken(null)}
                    onContextMenu={(e) => handleContextMenu(e, token, line)}
                  >
                    <span className="text-xs text-gray-400">{token.reading}</span>
                    
                    {isTokenActive ? (
                      <ProgressHighlighter 
                        surface={token.surface}
                        startTime={token.startTime}
                        endTime={token.endTime}
                        isActive={isTokenActive}
                        isHovered={isHovered}
                      />
                    ) : (
                      <span className={cn('block text-lg', {
                        'text-green-400': hasTokenPassed && !isHovered,
                        'text-yellow-300': isHovered,
                        'text-white': !hasTokenPassed && !isHovered,
                      })}>
                        {token.surface}
                      </span>
                    )}
                  </span>
                );
              })}
            </p>
            <p className="text-sm text-gray-300">{line.translation}</p>
          </div>
        );
      })}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getMenuItems(contextMenu.token, contextMenu.line)}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
};

export default LyricsDisplay;