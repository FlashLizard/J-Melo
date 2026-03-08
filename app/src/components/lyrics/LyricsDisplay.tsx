// app/src/components/lyrics/LyricsDisplay.tsx
import React, { useRef, useEffect, useState } from 'react';
import { LyricLine, LyricToken } from '@/interfaces/lyrics';
import { editorStoreActions } from '@/stores/useEditorStore';
import useEditorStore from '@/stores/useEditorStore';
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
  const katakanaToHiragana = (src: string) => {
    return src.replace(/[\u30a1-\u30f6]/g, (match) => {
      const chr = match.charCodeAt(0) - 0x60;
      return String.fromCharCode(chr);
    });
  };

  const activeLineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredToken, setHoveredToken] = useState<LyricToken | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; token: LyricToken; line: LyricLine; lineIndex: number } | null>(null);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null); 
  const { setActivePanel, setIsLyricsWizardOpen } = useUIPanelStore();
  const { startExplanation, clearTutor } = useTutorStore();
  const { isPlaying, playbackRate } = usePlayerStore();
  const { setActiveView } = useMobileViewStore();
  const { settings, toggleShowReadings, toggleShowTranslations, setLyricsFontSize } = useSettingsStore();
  const { t } = useTranslation();
  const { song, generateTranscriptionPreview, previewLyrics, commitPreviewLyrics, clearPreviewLyrics, clearAllTimestamps, updateLineTime } = useSongStore();
  const isTimeSyncMode = useEditorStore((state) => state.isTimeSyncMode);
  
  const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  const handleToggleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    playerStoreActions.setPlaybackRate(PLAYBACK_SPEEDS[nextIndex]);
  };

  const lastActiveLineId = useRef<number | null>(null);

  const smoothScrollTo = (element: HTMLElement, target: number, duration: number) => {
    const start = element.scrollTop;
    const change = target - start;
    let startTime: number | null = null;
    const animateScroll = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const timeElapsed = timestamp - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      const ease = progress * (2 - progress);
      element.scrollTop = start + change * ease;
      if (timeElapsed < duration) requestAnimationFrame(animateScroll);
    };
    requestAnimationFrame(animateScroll);
  };

  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [dragProgressTime, setDragProgressTime] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const displayTime = isDraggingProgress ? dragProgressTime : currentTime;
  const songDuration = usePlayerStore.getState().duration || 1;

  const handleScroll = () => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => setIsUserScrolling(false), 3000);
  };

  useEffect(() => {
      return () => { if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current); };
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
    x = Math.max(0, Math.min(x, rect.width));
    setDragProgressTime((x / rect.width) * songDuration);
  };

  const fontSizeMultiplier = settings.lyricsFontSize || 1.0;

  useEffect(() => {
    let activeIndex: number | null = null;
    for (let i = 0; i < (lyrics || []).length; i++) {
        const l = lyrics[i];
        if (l.startTime === 0 && l.endTime === 0) continue;
        let effectiveLineEnd = l.endTime === 0 ? Infinity : l.endTime;
        if (displayTime >= l.startTime && displayTime < effectiveLineEnd) { activeIndex = i; break; }
    }
    if (activeIndex !== lastActiveLineId.current) {
        lastActiveLineId.current = activeIndex;
        if (!isUserScrolling || isDraggingProgress) {
            if (activeLineRef.current && scrollContainerRef.current) {
              const scrollTo = activeLineRef.current.offsetTop - scrollContainerRef.current.offsetHeight / 2 + activeLineRef.current.offsetHeight / 2;
              if (isDraggingProgress) scrollContainerRef.current.scrollTo({ top: scrollTo, behavior: 'auto' });
              else smoothScrollTo(scrollContainerRef.current, scrollTo, 300);
            }
        }
    }
  }, [displayTime, lyrics, isDraggingProgress, isUserScrolling]);

  if (!lyrics || lyrics.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-in fade-in duration-1000">
            <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center mb-8 text-indigo-400">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">{t('lyricsDisplay.noLyrics.title')}</h3>
            <p className="text-gray-400 mb-10 max-w-xs mx-auto leading-relaxed text-sm">
                {t('lyricsDisplay.noLyrics.description')}
            </p>
            
            <div className="flex flex-col gap-4 w-full max-w-[280px]">
                <button
                    onClick={() => setIsLyricsWizardOpen(true)}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-900/40 flex items-center justify-center gap-3 active:scale-95"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    {t('lyricsWizard.recommendedFlowButton')}
                </button>
                
                <div className="grid grid-cols-2 gap-3 mt-2">
                    <button
                        onClick={() => song && generateTranscriptionPreview(song, t)}
                        className="py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl transition-all border border-gray-700/50 text-xs"
                    >
                        {t('lyricsDisplay.noLyrics.transcribeButton')}
                    </button>
                    <button
                        onClick={() => {
                            setActivePanel('TIMELESS_LYRICS_IMPORTER');
                            setActiveView('tools');
                        }}
                        className="py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl transition-all border border-gray-700/50 text-xs"
                    >
                        {t('lyricsDisplay.noLyrics.importButton')}
                    </button>
                </div>
            </div>
        </div>
    );
  }

  const handleContextMenu = (event: React.MouseEvent, token: LyricToken, line: LyricLine, lineIndex: number) => {
    event.preventDefault(); event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, token, line, lineIndex });
  };

  const getMenuItems = (token: LyricToken, line: LyricLine, lineIndex: number): MenuItem[] => [
    { label: '解释词语', action: () => { startExplanation(line, token); setActiveView('tools'); } },
    { label: '编辑句子', action: () => { clearTutor(); editorStoreActions.setEditingLine(line, lineIndex); setActivePanel('SENTENCE_EDITOR'); setActiveView('tools'); } },
  ];

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="h-full bg-gray-800 text-white relative flex flex-col" onClick={() => setContextMenu(null)}>
        <div className="absolute top-0 left-0 right-0 z-30 flex flex-col">
            {previewLyrics && (
                <div className="w-full p-2 bg-yellow-500/20 backdrop-blur-sm flex justify-center items-center gap-4 border-b border-yellow-700/30">
                    <p className="text-sm text-yellow-200">{t('lyricsDisplay.preview.title')}</p>
                    <button onClick={commitPreviewLyrics} className="px-3 py-1 text-xs bg-green-600 rounded-lg hover:bg-green-500">{t('lyricsDisplay.preview.accept')}</button>
                    <button onClick={clearPreviewLyrics} className="px-3 py-1 text-xs bg-red-600 rounded-lg hover:bg-red-500">{t('lyricsDisplay.preview.reject')}</button>
                </div>
            )}
            {isTimeSyncMode && (
                <div className="w-full p-2 bg-purple-900/80 backdrop-blur-sm flex justify-between items-center px-4 shadow-lg border-b border-purple-700">
                    <p className="text-sm font-bold text-purple-200">{t('toolPanel.timeSyncModeButton')}</p>
                    <div className="flex gap-2">
                        <button onClick={clearAllTimestamps} className="px-3 py-1 text-xs bg-red-600 rounded-lg hover:bg-red-500 text-white font-bold">{t('lyricsDisplay.timeSync.clearAll')}</button>
                        <button onClick={() => editorStoreActions.setTimeSyncMode(false)} className="px-3 py-1 text-xs bg-gray-600 rounded-lg hover:bg-gray-500 text-white">{t('lyricsDisplay.timeSync.exitMode')}</button>
                    </div>
                </div>
            )}
            <div className="w-full py-1.5 px-4 bg-gray-900/40 backdrop-blur-md flex justify-center border-b border-gray-700/50">
                <div className="flex items-center text-xs font-mono text-gray-400 select-none tracking-widest">
                    <span className="text-green-400 font-bold">{formatTime(displayTime)}</span>
                    <span className="mx-2 opacity-30">|</span>
                    <span>{formatTime(songDuration)}</span>
                </div>
            </div>
        </div>

      <div ref={scrollContainerRef} className={cn("flex-grow overflow-y-auto overflow-x-hidden pb-16 select-none", (isTimeSyncMode || previewLyrics) ? "pt-24" : "pt-12")} onWheel={handleScroll} onTouchMove={handleScroll}>
        {lyrics.map((line, lineIndex) => {
          let effectiveLineEnd = line.endTime === 0 ? Infinity : line.endTime;
          const isLineActive = line.startTime > 0 && displayTime >= line.startTime && displayTime < effectiveLineEnd;
          return (
            <div key={`line-${lineIndex}`} ref={isLineActive ? activeLineRef : null} className={cn('mb-6 transition-all duration-300 text-center p-2 rounded-lg', { 'opacity-50': !isLineActive, 'scale-105': isLineActive, 'bg-gray-700/50': selectedLineIndex === lineIndex })} onClick={() => setSelectedLineIndex(lineIndex)}>
              <p className="font-semibold tracking-wider mb-2" style={{ fontSize: `${1.5 * fontSizeMultiplier}rem`, lineHeight: 1.2 }}>
                {line.tokens.map((token, index) => {
                  const isTokenActive = isLineActive && displayTime >= token.startTime && displayTime < token.endTime;
                  const hasTokenPassed = (token.endTime > 0 && displayTime >= token.endTime);
                  const isHovered = hoveredToken === token;
                  return (
                    <span 
                      key={index} 
                      className="word-span inline-flex flex-col items-center align-bottom mr-1 cursor-pointer" 
                      onClick={(e) => { e.stopPropagation(); if (token.startTime > 0) playerStoreActions.seek(token.startTime); }} 
                      onMouseEnter={() => setHoveredToken(token)}
                      onMouseLeave={() => setHoveredToken(null)}
                      onContextMenu={(e) => handleContextMenu(e, token, line, lineIndex)}
                    >
                      <span className={cn("text-gray-400 block w-full text-center whitespace-nowrap transition-opacity", (settings.showReadings && token.reading && token.reading !== katakanaToHiragana(token.surface)) ? "opacity-100" : "opacity-0")} style={{ fontSize: `${0.75 * fontSizeMultiplier}rem`, height: `${1 * fontSizeMultiplier}rem` }}>{token.reading}</span>
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
                        <span className={cn('block whitespace-pre text-center leading-tight transition-colors', {
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
              {settings.showTranslations && line.translation && <p className="text-gray-300" style={{ fontSize: `${0.875 * fontSizeMultiplier}rem` }}>{line.translation}</p>}
              {(isTimeSyncMode || selectedLineIndex === lineIndex) && (
                <div className="mt-2 flex justify-center items-center gap-2 min-h-[32px]">
                    {isTimeSyncMode ? (
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-green-400 bg-black/30 px-2 py-0.5 rounded-md border border-green-900/30">{line.startTime.toFixed(2)}s</span>
                            <button className="bg-green-600 text-white py-1 px-3 rounded-full text-[10px]" onClick={(e) => { e.stopPropagation(); updateLineTime(lineIndex, 'start', displayTime); }}>START</button>
                            <button className="bg-red-600 text-white py-1 px-3 rounded-full text-[10px]" onClick={(e) => { e.stopPropagation(); updateLineTime(lineIndex, 'end', displayTime); }}>END</button>
                            <span className="text-[10px] font-mono text-red-400 bg-black/30 px-2 py-0.5 rounded-md border border-red-900/30">{line.endTime.toFixed(2)}s</span>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <button className="bg-blue-600 text-white py-1 px-3 rounded-full text-xs" onClick={(e) => { e.stopPropagation(); startExplanation(line, undefined); setActiveView('tools'); }}>{t('lyricsDisplay.explainSentenceButton')}</button>
                            <button className="bg-purple-600 text-white py-1 px-3 rounded-full text-xs" onClick={(e) => { e.stopPropagation(); clearTutor(); editorStoreActions.setEditingLine(line, lineIndex); setActivePanel('SENTENCE_EDITOR'); setActiveView('tools'); }}>{t('lyricsDisplay.editSentenceButton')}</button>
                        </div>
                    )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-0 right-0 left-0 bg-gray-800/90 backdrop-blur-sm z-20 border-t border-gray-700">
        <div ref={progressBarRef} className="w-full h-2 bg-gray-600 cursor-pointer group touch-none relative" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
            <div className="h-full bg-green-500 relative transition-none" style={{ width: `${(displayTime / songDuration) * 100}%` }}>
                <div className={cn("absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md transform translate-x-1/2 transition-opacity", isDraggingProgress ? "opacity-100" : "opacity-0 group-hover:opacity-100")}></div>
            </div>
        </div>
        <div className="p-3 flex w-full justify-between sm:justify-end items-center relative gap-4">
            <div className="flex space-x-2 bg-gray-700/50 rounded-full p-1 overflow-hidden flex-shrink-0">
               <button onClick={(e) => { e.stopPropagation(); setLyricsFontSize(Math.max(0.5, fontSizeMultiplier - 0.1)); }} className="p-1.5 rounded-full text-gray-300 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></button>
               <span className="text-xs text-gray-400 px-1 sm:px-2 flex items-center font-mono">{Math.round(fontSizeMultiplier * 100)}%</span>
               <button onClick={(e) => { e.stopPropagation(); setLyricsFontSize(Math.min(2.5, fontSizeMultiplier + 0.1)); }} className="p-1.5 rounded-full text-gray-300 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>
            </div>
            <div className="flex space-x-2 flex-shrink-0">
              <button onClick={handleToggleSpeed} className="lyric-toggle-button px-2 rounded-full text-white bg-indigo-600 font-mono text-xs min-w-[45px]">{playbackRate.toFixed(2)}x</button>
              <button onClick={(e) => { e.stopPropagation(); if (isPlaying) playerStoreActions.pause(); else playerStoreActions.play(); }} className="lyric-toggle-button p-2 rounded-full text-white bg-blue-600">{isPlaying ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>}</button>
              <button onClick={(e) => { e.stopPropagation(); toggleShowReadings(); }} className={cn("lyric-toggle-button p-2 rounded-full text-white", settings.showReadings ? "bg-green-600" : "bg-gray-600")}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg></button>
              <button onClick={(e) => { e.stopPropagation(); toggleShowTranslations(); }} className={cn("lyric-toggle-button p-2 rounded-full text-white", settings.showTranslations ? "bg-green-600" : "bg-gray-600")}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0113 3.414L16.586 7A2 2 0 0118 8.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" /></svg></button>
            </div>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={getMenuItems(contextMenu.token, contextMenu.line, contextMenu.lineIndex)} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
};

export default LyricsDisplay;
