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
  const { settings, toggleShowReadings, toggleShowTranslations, setLyricsFontSize } = useSettingsStore();
  const { t } = useTranslation();
  const { song, generateTranscriptionPreview, previewLyrics, commitPreviewLyrics, clearPreviewLyrics } = useSongStore();
  
  // Track the currently active line ID to trigger scrolls only on change
  const lastActiveLineId = useRef<string | null>(null);

  // Custom smooth scroll function with duration
  const smoothScrollTo = (element: HTMLElement, target: number, duration: number) => {
    const start = element.scrollTop;
    const change = target - start;
    let startTime: number | null = null;

    const animateScroll = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const timeElapsed = timestamp - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      
      // Easing: easeOutQuad
      const ease = progress * (2 - progress);
      
      element.scrollTop = start + change * ease;

      if (timeElapsed < duration) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  };

  // Dragging state for the progress bar
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [dragProgressTime, setDragProgressTime] = useState(0);
  
  // User manual scrolling state
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const displayTime = isDraggingProgress ? dragProgressTime : currentTime;
  const songDuration = usePlayerStore.getState().duration || 1;

  // Handle manual scroll to pause auto-scrolling
  const handleScroll = () => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
    }, 3000); // Resume auto-scroll after 3 seconds of inactivity
  };

  // Cleanup timeout on unmount
  useEffect(() => {
      return () => {
          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    setIsDraggingProgress(true);
    updateProgressFromEvent(e);
    progressBarRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingProgress) return;
    updateProgressFromEvent(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingProgress || !progressBarRef.current) return;
    setIsDraggingProgress(false);
    playerStoreActions.seek(dragProgressTime);
    progressBarRef.current.releasePointerCapture(e.pointerId);
  };

  const updateProgressFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width)); // Clamp between 0 and width
    const percentage = x / rect.width;
    setDragProgressTime(percentage * songDuration);
  };

  const fontSizeMultiplier = settings.lyricsFontSize || 1.0;

  useEffect(() => {
    // Determine which line is currently active based on displayTime
    const activeLine = lyrics?.find(l => displayTime >= l.startTime && displayTime < l.endTime);
    const activeId = activeLine?.id || null;

    // Only proceed if the active line has actually changed
    if (activeId !== lastActiveLineId.current) {
        lastActiveLineId.current = activeId;

        // Only auto-scroll if the user hasn't manually scrolled recently, OR if we are actively dragging the progress bar
        if (!isUserScrolling || isDraggingProgress) {
            if (activeLineRef.current && scrollContainerRef.current) {
              const activeLineTop = activeLineRef.current.offsetTop;
              const activeLineHeight = activeLineRef.current.offsetHeight;
              const containerHeight = scrollContainerRef.current.offsetHeight;

              const scrollTo = activeLineTop - containerHeight / 2 + activeLineHeight / 2;
              
              if (isDraggingProgress) {
                  // Instant snap when dragging
                  scrollContainerRef.current.scrollTo({ top: scrollTo, behavior: 'auto' });
              } else {
                  // Custom 300ms swift smooth scroll
                  smoothScrollTo(scrollContainerRef.current, scrollTo, 300);
              }
            }
        }
    }
  }, [displayTime, lyrics, isDraggingProgress, isUserScrolling]);

  if (!lyrics || lyrics.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <h3 className="text-lg font-semibold mb-4">{t('lyricsDisplay.noLyrics.title')}</h3>
            <div className="space-y-3">
                <button
                    onClick={() => song && generateTranscriptionPreview(song, t)}
                    className="w-full px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500"
                >
                    {t('lyricsDisplay.noLyrics.transcribeButton')}
                </button>
                <button
                    onClick={() => {
                        setActivePanel('TIMELESS_LYRICS_IMPORTER');
                        setActiveView('tools');
                    }}
                    className="w-full px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-500"
                >
                    {t('lyricsDisplay.noLyrics.importButton')}
                </button>
            </div>
        </div>
    );
  }

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

  const katakanaToHiragana = (text: string) => {
      return text.replace(/[\u30A1-\u30F6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
  };

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
      <div 
        ref={scrollContainerRef} 
        className="flex-grow overflow-y-auto overflow-x-hidden pt-4 pb-16 select-none"
        onWheel={handleScroll}
        onTouchMove={handleScroll}
      >
        {lyrics.map((line) => {
          const isLineActive = displayTime >= line.startTime && displayTime < line.endTime;
          const isLineSelected = selectedLineId === line.id;
          return (
            <div
              key={line.id}
              ref={isLineActive ? activeLineRef : null}
              className={cn('mb-6 transition-all duration-300 text-center p-2 rounded-lg', { 'opacity-50': !isLineActive, 'scale-105': isLineActive, 'bg-gray-700/50': isLineSelected })}
              onClick={() => handleLineSelect(line.id)}
            >
              <p className="font-semibold tracking-wider mb-2" style={{ fontSize: `${1.5 * fontSizeMultiplier}rem`, lineHeight: 1.2 }}>
                {line.tokens.map((token, index) => {
                  const isTokenActive = isLineActive && displayTime >= token.startTime && displayTime < token.endTime;
                  const hasTokenPassed = isLineActive && displayTime >= token.endTime;
                  const isHovered = hoveredToken === token;

                  return (
                    <span
                      key={`${token.surface}-${token.startTime}-${index}`}
                      className="word-span inline-flex flex-col items-center align-bottom mr-1 cursor-pointer"
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
                      <span className={cn(
                        "text-gray-400 block w-full text-center whitespace-nowrap",
                        (settings.showReadings && token.reading && token.reading !== katakanaToHiragana(token.surface)) ? "visible" : "invisible"
                      )} style={{ fontSize: `${0.75 * fontSizeMultiplier}rem`, height: `${1 * fontSizeMultiplier}rem`, lineHeight: 1 }}>
                        {token.reading}
                      </span>
                      
                      {isTokenActive ? (
                        <ProgressHighlighter 
                          surface={token.surface}
                          startTime={token.startTime}
                          endTime={token.endTime}
                          isActive={isTokenActive}
                          isHovered={isHovered}
                          fontSizeMultiplier={fontSizeMultiplier}
                          currentTime={displayTime}
                        />
                      ) : (
                        <span className={cn('block whitespace-pre text-center leading-tight', {
                          'text-green-400': hasTokenPassed && !isHovered,
                          'text-yellow-300': isHovered,
                          'text-white': !hasTokenPassed && !isHovered,
                        })} style={{ fontSize: `${1.125 * fontSizeMultiplier}rem` }}>
                          {token.surface}
                        </span>
                      )}
                    </span>
                  );
                })}
              </p>
              <div className={cn("transition-opacity duration-200", settings.showTranslations ? "opacity-100" : "opacity-0 invisible h-0")} style={{ minHeight: `${1.25 * fontSizeMultiplier}rem` }}>
                <p className="text-gray-300" style={{ fontSize: `${0.875 * fontSizeMultiplier}rem` }}>{line.translation}</p>
              </div>
              
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
      <div className="absolute bottom-0 right-0 left-0 bg-gray-800/90 backdrop-blur-sm z-20 border-t border-gray-700">
        {/* Progress Bar */}
        <div 
            ref={progressBarRef}
            className="w-full h-2 bg-gray-600 cursor-pointer group touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div 
                className="h-full bg-green-500 relative transition-none"
                style={{ width: `${(displayTime / songDuration) * 100}%` }}
            >
                <div className={cn(
                    "absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md transform translate-x-1/2 transition-opacity",
                    isDraggingProgress ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}></div>
            </div>
        </div>

        <div className="p-3 flex space-x-2 w-full justify-between sm:justify-end items-center">
            <div className="flex space-x-2 bg-gray-700/50 rounded-full p-1">
               <button
                  onClick={(e) => { e.stopPropagation(); setLyricsFontSize(Math.max(0.5, fontSizeMultiplier - 0.1)); }}
                  className="p-1.5 rounded-full text-gray-300 hover:text-white hover:bg-gray-600 transition-colors"
                  title={t('lyricsDisplay.decreaseFontSize') || "Decrease Font Size"}
               >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
               </button>
               <span className="text-xs text-gray-400 px-2 flex items-center font-mono">{Math.round(fontSizeMultiplier * 100)}%</span>
               <button
                  onClick={(e) => { e.stopPropagation(); setLyricsFontSize(Math.min(2.5, fontSizeMultiplier + 0.1)); }}
                  className="p-1.5 rounded-full text-gray-300 hover:text-white hover:bg-gray-600 transition-colors"
                  title={t('lyricsDisplay.increaseFontSize') || "Increase Font Size"}
               >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
               </button>
            </div>

            <div className="flex space-x-2">
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
        </div>
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