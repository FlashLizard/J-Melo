import React, { useRef, useEffect, useState } from 'react';
import { LyricLine, LyricToken } from '@/interfaces/lyrics';
import { editorStoreActions } from '@/stores/useEditorStore';
import useTutorStore from '@/stores/useTutorStore';
import { playerStoreActions } from '@/stores/usePlayerStore';
import usePlayerStore from '@/stores/usePlayerStore';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useMobileViewStore from '@/stores/useMobileViewStore';
import useSettingsStore from '@/stores/useSettingsStore';
import useSongStore from '@/stores/useSongStore';
import useTranslation from '@/hooks/useTranslation';
import ContextMenu, { MenuItem } from '@/components/common/ContextMenu';
import cn from 'classnames';
import ProgressHighlighter from './ProgressHighlighter';

interface Props {
  lyrics: LyricLine[];
  currentTime: number;
}

const LyricsDisplay: React.FC<Props> = ({ lyrics, currentTime }) => {
  const activeLineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredToken, setHoveredToken] = useState<LyricToken | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; token: LyricToken; line: LyricLine } | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null); // New state for selected line
  const { setActivePanel } = useUIPanelStore();
  const { startExplanation, clearTutor } = useTutorStore();
  const { isPlaying } = usePlayerStore();
  const { setActiveView } = useMobileViewStore();
  const { settings, toggleShowReadings, toggleShowTranslations } = useSettingsStore();
  const { t } = useTranslation();
  const { song, generateTranscriptionPreview, previewLyrics, commitPreviewLyrics, clearPreviewLyrics } = useSongStore();

  if (!lyrics || lyrics.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <h3 className="text-lg font-semibold mb-4">{t('lyricsDisplay.noLyrics.title')}</h3>
            <div className="space-y-3">
                <button
                    onClick={() => song && generateTranscriptionPreview(song)}
                    className="w-full px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500"
                >
                    {t('lyricsDisplay.noLyrics.transcribeButton')}
                </button>
                <button
                    onClick={() => setActivePanel('TIMELESS_LYRICS_IMPORTER')}
                    className="w-full px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-500"
                >
                    {t('lyricsDisplay.noLyrics.importButton')}
                </button>
            </div>
        </div>
    );
  }
  
  useEffect(() => {
    if (activeLineRef.current && scrollContainerRef.current) {
      const activeLineTop = activeLineRef.current.offsetTop;
      const activeLineHeight = activeLineRef.current.offsetHeight;
      const containerScrollTop = scrollContainerRef.current.scrollTop;
      const containerHeight = scrollContainerRef.current.offsetHeight;

      const scrollTo = activeLineTop - containerHeight / 2 + activeLineHeight / 2;
      scrollContainerRef.current.scrollTo({ top: scrollTo, behavior: 'smooth' });
    }
  }, [activeLineRef, currentTime, lyrics]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (contextMenu) {
      closeContextMenu();
      return;
    }
  };

  const handleContextMenu = (event: React.MouseEvent, token: LyricToken, line: LyricLine) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, token, line });
  };

  const closeContextMenu = () => setContextMenu(null);
  
  const handleLineSelect = (lineId: string) => {
    setSelectedLineId(prevId => (prevId === lineId ? null : lineId)); // Toggle selection
  };

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
    <div className="h-full bg-gray-800 text-white relative flex flex-col" onClick={handleContainerClick}>
        {previewLyrics && (
            <div className="absolute top-0 left-0 right-0 p-2 bg-yellow-500/20 backdrop-blur-sm z-30 flex justify-center items-center gap-4">
                <p className="text-sm text-yellow-200">{t('lyricsDisplay.preview.title')}</p>
                <button onClick={commitPreviewLyrics} className="px-3 py-1 text-xs bg-green-600 rounded-lg hover:bg-green-500">{t('lyricsDisplay.preview.accept')}</button>
                <button onClick={clearPreviewLyrics} className="px-3 py-1 text-xs bg-red-600 rounded-lg hover:bg-red-500">{t('lyricsDisplay.preview.reject')}</button>
            </div>
        )}
      {/* Scrollable lyrics content */}
      <div ref={scrollContainerRef} className="flex-grow overflow-y-auto overflow-x-hidden pt-4 pb-16 select-none">
        {lyrics.map((line) => {
          const isLineActive = currentTime >= line.startTime && currentTime < line.endTime;
          const isLineSelected = selectedLineId === line.id;
          return (
            <div
              key={line.id}
              ref={isLineActive ? activeLineRef : null}
              className={cn('mb-6 transition-all duration-300 text-center p-2 rounded-lg', { 'opacity-50': !isLineActive, 'scale-105': isLineActive, 'bg-gray-700/50': isLineSelected })}
              onClick={() => handleLineSelect(line.id)}
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
                        if (token.startTime > 0) { // Only seek if startTime is not 0
                            playerStoreActions.seek(token.startTime);
                        }
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
              
              {isLineSelected && (
                <div className="mt-2 flex justify-center gap-2">
                    <button 
                        className="line-action-button text-xs bg-blue-600 hover:bg-blue-500 text-white py-1 px-3 rounded-full"
                        onClick={(e) => {
                            e.stopPropagation();
                            startExplanation(line, undefined);
                            setActiveView('tools');
                        }}
                    >
                        {t('lyricsDisplay.explainSentenceButton')}
                    </button>
                    <button 
                        className="line-action-button text-xs bg-purple-600 hover:bg-purple-500 text-white py-1 px-3 rounded-full"
                        onClick={(e) => {
                            e.stopPropagation();
                            clearTutor();
                            editorStoreActions.setEditingLine(line);
                            setActivePanel('SENTENCE_EDITOR');
                            setActiveView('tools');
                        }}
                    >
                        {t('lyricsDisplay.editSentenceButton')}
                    </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fixed button bar at the bottom */}
      <div className="absolute bottom-0 right-0 p-4 flex space-x-2 z-20 bg-gray-800/80 backdrop-blur-sm w-full justify-end">
          <button
              onClick={(e) => { 
                e.stopPropagation(); 
                if (isPlaying) playerStoreActions.pause();
                else playerStoreActions.play();
              }}
              className="lyric-toggle-button p-2 rounded-full text-white bg-blue-600 hover:bg-blue-500"
              title={isPlaying ? "Pause" : "Play"}
          >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
          </button>
          <button
              onClick={(e) => { e.stopPropagation(); toggleShowReadings(); }}
              className={cn(
                  "lyric-toggle-button p-2 rounded-full text-white",
                  settings.showReadings ? "bg-green-600 hover:bg-green-500" : "bg-gray-600 hover:bg-gray-500"
              )}
              title={settings.showReadings ? "Hide Readings" : "Show Readings"}
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
          </button>
          <button
              onClick={(e) => { e.stopPropagation(); toggleShowTranslations(); }}
              className={cn(
                  "lyric-toggle-button p-2 rounded-full text-white",
                  settings.showTranslations ? "bg-green-600 hover:bg-green-500" : "bg-gray-600 hover:bg-gray-500"
              )}
              title={settings.showTranslations ? "Hide Translations" : "Show Translations"}
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0113 3.414L16.586 7A2 2 0 0118 8.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
          </button>
      </div>

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