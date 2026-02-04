// src/components/lyrics/LyricsDisplay.tsx
import React, { useRef, useEffect, useState } from 'react';
import { LyricLine, LyricToken } from '@/interfaces/lyrics';
import { editorStoreActions } from '@/stores/useEditorStore';
import useTutorStore from '@/stores/useTutorStore';
import { playerStoreActions } from '@/stores/usePlayerStore';
import usePlayerStore from '@/stores/usePlayerStore';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useMobileViewStore from '@/stores/useMobileViewStore';
import useSettingsStore from '@/stores/useSettingsStore'; // Import useSettingsStore
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
  const { settings, toggleShowReadings, toggleShowTranslations } = useSettingsStore();

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineRef, currentTime]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (contextMenu) {
      closeContextMenu();
      return;
    }

    const target = e.target as HTMLElement;
    const wordSpan = target.closest('.word-span');

    if (!wordSpan) {
      if (isPlaying) {
        playerStoreActions.pause();
      } else {
        playerStoreActions.play();
      }
    }
  };

  const handleContextMenu = (event: React.MouseEvent, token: LyricToken, line: LyricLine) => {
    event.preventDefault(); // Prevent browser's default context menu
    event.stopPropagation(); // Stop propagation to container's onClick
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
    <div className="h-full overflow-y-auto overflow-x-hidden p-4 bg-gray-800 text-white relative" onClick={handleContainerClick}>
        <div className="absolute top-4 right-4 flex space-x-2 z-10">
            <button
                onClick={(e) => { e.stopPropagation(); toggleShowReadings(); }}
                className={cn(
                    "p-2 rounded-full text-white", // Added text-white for clarity
                    settings.showReadings ? "bg-green-600 hover:bg-green-500" : "bg-gray-600 hover:bg-gray-500"
                )}
                title={settings.showReadings ? "Hide Readings" : "Show Readings"}
            >
                {/* Eye icon for readings */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); toggleShowTranslations(); }}
                className={cn(
                    "p-2 rounded-full text-white", // Added text-white for clarity
                    settings.showTranslations ? "bg-green-600 hover:bg-green-500" : "bg-gray-600 hover:bg-gray-500"
                )}
                title={settings.showTranslations ? "Hide Translations" : "Show Translations"}
            >
                {/* Text icon for translations */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0113 3.414L16.586 7A2 2 0 0118 8.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
            </button>
        </div>

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
                    className="word-span inline-block align-bottom mr-1 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      playerStoreActions.seek(token.startTime);
                    }}
                    onMouseEnter={() => setHoveredToken(token)}
                    onMouseLeave={() => setHoveredToken(null)}
                    onContextMenu={(e) => handleContextMenu(e, token, line)}
                  >
                    {settings.showReadings && <span className="text-xs text-gray-400">{token.reading}</span>}
                    
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
            {settings.showTranslations && <p className="text-sm text-gray-300">{line.translation}</p>}
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
