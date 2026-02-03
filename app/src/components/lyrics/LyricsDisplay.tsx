// src/components/lyrics/LyricsDisplay.tsx
import React, { useRef, useEffect, useState } from 'react';
import { LyricLine, LyricToken } from '@/lib/mock-data';
import { editorStoreActions } from '@/stores/useEditorStore';
import { tutorStoreActions } from '@/stores/useTutorStore';
import { playerStoreActions } from '@/stores/usePlayerStore'; // Import playerStoreActions
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

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [lyrics, currentTime]);

  const handleWordClick = (startTime: number) => {
    playerStoreActions.seek(startTime);
  };

  const handleContextMenu = (event: React.MouseEvent, token: LyricToken, line: LyricLine) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, token, line });
  };

  const closeContextMenu = () => setContextMenu(null);

  const getMenuItems = (token: LyricToken, line: LyricLine): MenuItem[] => [
    { label: `解释 "${token.surface}"`, action: () => tutorStoreActions.setSelectedText(token.surface) },
    { label: '编辑句子', action: () => editorStoreActions.setEditingLine(line) },
    { label: '自定义动作 1', action: () => alert('Custom action 1'), disabled: true },
    { label: '自定义动作 2', action: () => alert('Custom action 2'), disabled: true },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-800 text-white" onClick={closeContextMenu}>
      {lyrics.map((line) => {
        const isLineActive = currentTime >= line.startTime && currentTime < line.endTime;
        return (
          <div
            key={line.id}
            ref={isLineActive ? activeLineRef : null}
            className={cn('mb-6 transition-all duration-300', { 'opacity-50': !isLineActive, 'scale-105': isLineActive })}
          >
            <p className="text-2xl font-semibold tracking-wider mb-2">
              {line.tokens.map((token, index) => {
                const isTokenActive = isLineActive && currentTime >= token.startTime && currentTime < token.endTime;
                const hasTokenPassed = isLineActive && currentTime >= token.endTime;
                const isHovered = hoveredToken === token;

                return (
                                      <span
                                      key={`${token.surface}-${token.startTime}-${index}`}
                                      className="inline-block align-bottom mr-1 cursor-pointer"
                                      onClick={() => handleWordClick(token.startTime)}
                                      onMouseEnter={() => setHoveredToken(token)}
                                      onMouseLeave={() => setHoveredToken(null)}
                                      onContextMenu={(e) => handleContextMenu(e, token, line)}
                                    >                    <span className="text-xs text-gray-400">{token.reading}</span>
                    
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
