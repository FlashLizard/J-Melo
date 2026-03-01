// app/src/components/editor/SentenceEditor.tsx
import EditableWordRow from './EditableWordRow';
import { LyricLine, LyricToken } from '@/interfaces/lyrics';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import useTranslation from '@/hooks/useTranslation'; // Import useTranslation
import useMobileViewStore from '@/stores/useMobileViewStore'; // Import useMobileViewStore
import cn from 'classnames';
import toast from 'react-hot-toast';

const MemoizedResizableWordBlock = React.memo(ResizableWordBlock);
const MemoizedEditableWordRow = React.memo(EditableWordRow);

interface SentenceEditorProps {
  line: LyricLine;
  lineIndex: number;
  onSave: (index: number, updatedLine: LyricLine) => void;
  onCancel: () => void;
  relativeAudioUrl: string;
}

const SentenceEditor: React.FC<SentenceEditorProps> = ({ line, lineIndex, onSave, onCancel, relativeAudioUrl }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { setActiveView } = useMobileViewStore(); // Get setActiveView
  const songAudioUrl = relativeAudioUrl;
  const [currentLine, setCurrentLine] = useState<LyricLine>(line);
  const [addMode, setAddMode] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentAudioTime, setCurrentAudioTime] = useState(line.startTime);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [activeTokenIndex, setActiveTokenIndex] = useState<number | null>(null);
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const animationFrameRef = useRef<number>(0);

  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual');
  const [jsonString, setJsonString] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const lineDuration = useMemo(() => currentLine.endTime - currentLine.startTime, [currentLine]);
  const THUMB_WIDTH_PX = 16; 
  const THUMB_HALF_WIDTH_PX = THUMB_WIDTH_PX / 2;

  useEffect(() => {
    setCurrentLine(line);
    setCurrentAudioTime(line.startTime);
    setJsonString(JSON.stringify(line, null, 2));
    setJsonError(null);
    setSelectedTokenIndex(null);
    setIsAudioPlaying(false);
    if (audioRef.current) {
        audioRef.current.currentTime = line.startTime;
        audioRef.current.pause();
    }
  }, [line]);

  useEffect(() => {
    const handleResize = () => {
      if (timelineRef.current) setTimelineWidth(timelineRef.current.offsetWidth);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const animate = () => {
      if (audioRef.current && !isScrubbing) {
        setCurrentAudioTime(audioRef.current.currentTime);
        if (audioRef.current.currentTime >= currentLine.endTime) {
          setIsAudioPlaying(false);
          setCurrentAudioTime(currentLine.startTime);
          audioRef.current.pause();
        } else {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      }
    };
    if (isAudioPlaying) animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isAudioPlaying, currentLine.endTime, currentLine.startTime, isScrubbing]);

  useEffect(() => {
    const activeIndex = currentLine.tokens.findIndex(t => currentAudioTime >= t.startTime && currentAudioTime < t.endTime);
    setActiveTokenIndex(activeIndex);
  }, [currentAudioTime, currentLine.tokens]);

  const handlePlay = useCallback(() => {
    if (audioRef.current) {
      if (audioRef.current.currentTime < currentLine.startTime || audioRef.current.currentTime >= currentLine.endTime) {
        audioRef.current.currentTime = currentLine.startTime;
      }
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play();
      setIsAudioPlaying(true);
    }
  }, [currentLine.startTime, currentLine.endTime, playbackRate]);
  
  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
    }
  }, []);

  const handlePlaybackRateChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRate = Number(e.target.value);
    setPlaybackRate(newRate);
    if (audioRef.current) audioRef.current.playbackRate = newRate;
  }, []);
  
  const handleScrubberChange = useCallback((newTime: number) => {
    if (audioRef.current) {
      setCurrentAudioTime(newTime);
      audioRef.current.currentTime = newTime;
    }
  }, []);

  const handleTimeUpdate = useCallback((index: number, type: 'move' | 'resize-left' | 'resize-right', newStart: number, newEnd: number) => {
    setCurrentLine(prevLine => {
        const newTokens = [...prevLine.tokens];
        const minDuration = 0.05;
        if (type === 'move') {
            const prevBoundary = index > 0 ? newTokens[index - 1].endTime : prevLine.startTime;
            const nextBoundary = index < newTokens.length - 1 ? newTokens[index + 1].startTime : prevLine.endTime;
            const duration = newEnd - newStart;
            newStart = Math.max(prevBoundary, newStart);
            newEnd = newStart + duration;
            if (newEnd > nextBoundary) {
                newEnd = nextBoundary;
                newStart = newEnd - duration;
            }
        } else { 
             if (newEnd - newStart < minDuration) {
                if (type === 'resize-left') newStart = newEnd - minDuration;
                else newEnd = newStart + minDuration;
            }
            if (type === 'resize-right') {
                const nextToken = newTokens[index + 1];
                if (nextToken && newEnd > nextToken.startTime) {
                    newTokens[index + 1] = { ...nextToken, startTime: newEnd };
                }
            } else if (type === 'resize-left') {
                const prevToken = newTokens[index - 1];
                if (prevToken && newStart < prevToken.endTime) {
                    newTokens[index - 1] = { ...prevToken, endTime: newStart };
                }
            }
        }
        newTokens[index] = { ...newTokens[index], startTime: newStart, endTime: newEnd };
        const updatedLine = { ...prevLine, tokens: newTokens.sort((a,b) => a.startTime - b.startTime) };
        setJsonString(JSON.stringify(updatedLine, null, 2));
        return updatedLine;
    });
  }, []);

  const handleTokenChange = useCallback((index: number, field: keyof LyricToken, value: any) => {
      setCurrentLine(prevLine => {
          const newTokens = [...prevLine.tokens];
          newTokens[index] = { ...newTokens[index], [field]: value };
          const updatedLine = { ...prevLine, tokens: newTokens };
          setJsonString(JSON.stringify(updatedLine, null, 2));
          return updatedLine;
      });
  }, []);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (addMode) {
      if (!timelineRef.current || (e.target as HTMLElement).closest('.word-block')) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const adjustedClickX = clickX - THUMB_HALF_WIDTH_PX;
      const clickTime = currentLine.startTime + (adjustedClickX / (timelineWidth - THUMB_WIDTH_PX)) * lineDuration;
      
      const minDuration = 0.05; // 50ms minimum duration for a new token
      let maxAllowedEndTime = currentLine.endTime;

      // Find the next token that comes after our click to prevent overlap
      const nextToken = currentLine.tokens.find(t => t.startTime > clickTime);
      if (nextToken) {
          maxAllowedEndTime = nextToken.startTime;
      }

      const availableSpace = maxAllowedEndTime - clickTime;
      if (availableSpace < minDuration) {
          alert(t('sentenceEditor.spaceTooSmallAlert') || "Not enough space to add a new word here.");
          return;
      }

      const newEndTime = Math.min(clickTime + 0.1, maxAllowedEndTime); // Default to 0.1s, cap at next token
      
      const newToken: LyricToken = { surface: 'new', reading: 'new', romaji: 'new', startTime: clickTime, endTime: newEndTime, partOfSpeech: 'noun' };
      setCurrentLine(prevLine => {
        const updatedLine = { ...prevLine, tokens: [...prevLine.tokens, newToken].sort((a, b) => a.startTime - b.startTime) };
        setJsonString(JSON.stringify(updatedLine, null, 2));
        return updatedLine;
      });
      setAddMode(false);
    } else {
        setSelectedTokenIndex(null);
    }
  };

  const handleDeleteToken = useCallback((tokenIndex: number) => {
    setCurrentLine(prevLine => {
      const updatedLine = {
        ...prevLine,
        tokens: prevLine.tokens.filter((_, index) => index !== tokenIndex),
      };
      setJsonString(JSON.stringify(updatedLine, null, 2));
      return updatedLine;
    });
    setDeleteMode(false);
  }, []);

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newJsonString = e.target.value;
    setJsonString(newJsonString);
    try {
      const parsed = JSON.parse(newJsonString);
      // Validate that it's a single LyricLine object, not an array
      if (Array.isArray(parsed)) {
          throw new Error('Please enter a single LyricLine object, not an array of lines.');
      }
      if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Invalid LyricLine object structure.');
      }
      // Ensure the text matches or whatever validation, but we don't have ID anymore.
      
      setCurrentLine(parsed as LyricLine);
      setJsonError(null);
    } catch (error) {
      setJsonError((error as Error).message);
    }
  };

  const handleSaveClick = () => {
    if (jsonError) {
      toast.error(t('sentenceEditor.jsonSaveError', { error: jsonError }));
      return;
    }
    setActiveView('lyrics'); // Navigate to lyrics view on mobile after save
    onSave(lineIndex, currentLine);
  };
  
  const handleCancelClick = () => {
    setActiveView('lyrics'); // Navigate to lyrics view on mobile after cancel
    onCancel();
  };

  return (
    <div className="bg-gray-800 p-4 rounded-xl h-full flex flex-col shadow-lg border border-gray-700/50">
      {/* Header Area */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700/50">
        <h2 className="text-xl font-bold text-white tracking-wide">{t('sentenceEditor.title')}</h2>
        <div className="flex items-center gap-4">
          {/* Modern Segmented Control for Mode */}
          <div className="flex bg-gray-900/80 p-1 rounded-lg border border-gray-700/50 shadow-inner">
            <button
              onClick={() => setEditorMode('visual')}
              className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-200",
                editorMode === 'visual' ? "bg-gray-700 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
              )}
            >
              {t('sentenceEditor.visualMode')}
            </button>
            <button
              onClick={() => setEditorMode('json')}
              className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-200",
                editorMode === 'json' ? "bg-gray-700 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
              )}
            >
              {t('sentenceEditor.jsonMode')}
            </button>
          </div>
        </div>
      </div>      
      <div className="flex-grow flex flex-col min-h-0 custom-scrollbar">
        {editorMode === 'visual' ? 
          <VisualEditor 
            {...{
              addMode, setAddMode, deleteMode, setDeleteMode, timelineRef, timelineWidth, 
              currentLine, setCurrentLine, lineDuration, handleTimelineClick, activeTokenIndex, selectedTokenIndex, 
              setSelectedTokenIndex, handleTimeUpdate, handleDeleteToken, handleTokenChange,
              currentAudioTime, handleScrubberChange, isScrubbing, setIsScrubbing, handlePlay,
              THUMB_WIDTH_PX, THUMB_HALF_WIDTH_PX, t 
            }}
          /> : 
          <JsonEditor jsonString={jsonString} handleJsonChange={handleJsonChange} jsonError={jsonError} t={t} />}
      </div>
      
      {/* Bottom Control Bar */}
      <div className="mt-6 pt-4 border-t border-gray-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-center sm:justify-start">
          <button 
            onClick={isAudioPlaying ? handleStop : handlePlay} 
            className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md",
              isAudioPlaying ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" : "bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 active:scale-95"
            )}
            title={isAudioPlaying ? t('sentenceEditor.stopPlayback') : t('sentenceEditor.playPlayback')}
          >
            {isAudioPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
            )}
          </button>
          
          <div className="relative">
            <select 
                value={playbackRate} 
                onChange={handlePlaybackRateChange} 
                className="appearance-none bg-gray-700/50 text-gray-200 text-xs font-semibold py-2 pl-3 pr-8 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-gray-700 transition-colors"
            >
              <option value={0.5}>0.5x Speed</option>
              <option value={0.75}>0.75x Speed</option>
              <option value={1}>1.0x Speed</option>
              <option value={1.25}>1.25x Speed</option>
              <option value={1.5}>1.5x Speed</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
        </div>

        <div className="flex w-full sm:w-auto gap-2">
          <button 
            onClick={handleCancelClick} 
            className="flex-1 sm:flex-none px-6 py-2.5 bg-gray-700 rounded-lg hover:bg-gray-600 text-white font-medium transition-colors"
          >
            {t('sentenceEditor.cancelButton')}
          </button>
          <button 
            onClick={handleSaveClick} 
            className="flex-1 sm:flex-none px-6 py-2.5 bg-green-600 rounded-lg hover:bg-green-500 text-white font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
            disabled={jsonError !== null}
          >
            {t('sentenceEditor.saveButton')}
          </button>
        </div>
      </div>
      <audio ref={audioRef} src={songAudioUrl} preload="auto" />
    </div>
  );
};

const VisualEditor = ({
  addMode, setAddMode, deleteMode, setDeleteMode, timelineRef, timelineWidth, 
  currentLine, setCurrentLine, lineDuration, handleTimelineClick, activeTokenIndex, selectedTokenIndex, 
  setSelectedTokenIndex, handleTimeUpdate, handleDeleteToken, handleTokenChange,
  currentAudioTime, handleScrubberChange, isScrubbing, setIsScrubbing, handlePlay,
  THUMB_WIDTH_PX, THUMB_HALF_WIDTH_PX, t 
}: any) => { 
  const [dragProgressTime, setDragProgressTime] = useState(0);

  const effectiveTimelineWidth = timelineWidth - THUMB_WIDTH_PX;
  
  // Decouple visual time from actual audio time during drag
  const displayTime = isScrubbing ? dragProgressTime : currentAudioTime;
  const progressPercent = lineDuration > 0 ? Math.min(100, Math.max(0, ((displayTime - currentLine.startTime) / lineDuration) * 100)) : 0;
  
  const innerTrackRef = useRef<HTMLDivElement>(null);

  const updateProgressFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!innerTrackRef.current) return;
      const rect = innerTrackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      const newTime = currentLine.startTime + percentage * lineDuration;
      setDragProgressTime(newTime);
  };

  return (
    <>
      <div className="flex justify-end space-x-2 mb-4">
        <button onClick={() => { setAddMode(!addMode); setDeleteMode(false); }} className={`p-2 rounded-full ${addMode ? 'bg-green-500' : 'bg-gray-600'} hover:bg-green-500 text-white`} title={t('sentenceEditor.addWordButtonTitle')}><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg></button>
        <button onClick={() => { setDeleteMode(!deleteMode); setAddMode(false); }} className={`p-2 rounded-full ${deleteMode ? 'bg-red-500' : 'bg-gray-600'} hover:bg-red-500 text-white`} title={t('sentenceEditor.deleteWordButtonTitle')}><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></button>
      </div>
      
      <div className="px-1 sm:px-4">
        <div 
          ref={timelineRef} 
          className="border border-gray-700 rounded-lg relative h-24 overflow-hidden" 
          onClick={handleTimelineClick}
        >
          {/* Inner playable area container to handle boundaries cleanly */}
          <div className="absolute inset-y-0 left-0 right-0" style={{ marginLeft: `${THUMB_HALF_WIDTH_PX}px`, marginRight: `${THUMB_HALF_WIDTH_PX}px` }}>
              {timelineWidth > 0 && currentLine.tokens.map((token: LyricToken, index: number) => (
                  <MemoizedResizableWordBlock 
                    key={`${token.startTime}-${token.surface}`} 
                    index={index} 
                    token={token} 
                    lineStartTime={currentLine.startTime} 
                    lineDuration={lineDuration} 
                    timelineWidth={effectiveTimelineWidth}
                    onTimeUpdate={handleTimeUpdate} 
                    onDelete={() => handleDeleteToken(index)} 
                    isPlaying={activeTokenIndex === index} 
                    deleteMode={deleteMode} 
                    isSelected={selectedTokenIndex === index} 
                    onSelect={() => setSelectedTokenIndex(index)} 
                  />
              ))}
              {/* Timeline Scrubber Pointer */}
              <div 
                className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none z-30 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                style={{ left: `${progressPercent}%` }} 
              >
                 <div className="absolute -top-0 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500"></div>
              </div>
          </div>
        </div>
        
        {/* Custom Progress Bar for Sentence Editor */}
        <div className="w-full mt-6 mb-4 relative" style={{ paddingLeft: `${THUMB_HALF_WIDTH_PX}px`, paddingRight: `${THUMB_HALF_WIDTH_PX}px` }}>
            <div 
                className="absolute inset-y-0 left-0 right-0 flex items-center cursor-pointer group touch-none z-10"
                style={{ marginLeft: `${THUMB_HALF_WIDTH_PX}px`, marginRight: `${THUMB_HALF_WIDTH_PX}px` }}
                onPointerDown={(e) => {
                    setIsScrubbing(true);
                    useMobileViewStore.getState().setSwipeDisabled(true);
                    updateProgressFromEvent(e);
                    e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                    if (isScrubbing) {
                        updateProgressFromEvent(e);
                    }
                }}
                onPointerUp={(e) => {
                    if (isScrubbing) {
                        setIsScrubbing(false);
                        useMobileViewStore.getState().setSwipeDisabled(false);
                        e.currentTarget.releasePointerCapture(e.pointerId);
                        handleScrubberChange(dragProgressTime); 
                        if (handlePlay) handlePlay();
                    }
                }}
                onPointerCancel={(e) => {
                    if (isScrubbing) {
                        setIsScrubbing(false);
                        useMobileViewStore.getState().setSwipeDisabled(false);
                        e.currentTarget.releasePointerCapture(e.pointerId);
                    }
                }}
            >
                <div ref={innerTrackRef} className="w-full h-2 bg-gray-700 rounded-full overflow-hidden relative shadow-inner">
                    <div 
                        className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-none relative"
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
                
                {/* Modern Draggable Thumb */}
                <div 
                    className={cn(
                        "absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)] transform -translate-x-1/2 transition-transform duration-100",
                        isScrubbing ? "scale-125" : "scale-100 hover:scale-110"
                    )}
                    style={{ left: `${progressPercent}%` }}
                ></div>
            </div>
            {/* Invisible spacer to maintain height */}
            <div className="h-6"></div>
        </div>

        <div className="flex justify-between text-xs text-gray-400 font-mono mt-1" style={{ paddingLeft: `${THUMB_HALF_WIDTH_PX}px`, paddingRight: `${THUMB_HALF_WIDTH_PX}px` }}>
          <span>{currentLine.startTime.toFixed(2)}s</span>
          <span>{currentLine.endTime.toFixed(2)}s</span>
        </div>
      </div>

      <div className="px-1 sm:px-4 mt-2">
          <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">{t('sentenceEditor.translationLabel') || 'Translation'}</label>
          <textarea 
              rows={2}
              value={currentLine.translation || ''}
              onChange={(e) => {
                  const newTranslation = e.target.value;
                  setCurrentLine(prev => ({ ...prev, translation: newTranslation }));
              }}
              className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none transition-shadow"
              placeholder={t('sentenceEditor.translationPlaceholder') || 'Enter translation for this sentence...'}
          />
      </div>

      <div className="flex-grow overflow-y-auto overflow-x-hidden space-y-2 pr-2 mt-4 custom-scrollbar">
        <div className="grid grid-cols-12 gap-3 items-center px-4 py-2 text-gray-400 text-xs uppercase tracking-wider font-bold">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-3">{t('sentenceEditor.surfaceHeader')}</div>
          <div className="col-span-2">{t('sentenceEditor.readingHeader')}</div>
          <div className="col-span-3 text-center">{t('sentenceEditor.startHeader')}</div>
          <div className="col-span-3 text-center">{t('sentenceEditor.endHeader')}</div>
        </div>
        <div className="space-y-2">
            {currentLine.tokens.map((token: LyricToken, index: number) => (<MemoizedEditableWordRow key={`word-${index}`} index={index} token={token} onTokenChange={handleTokenChange}/>))}
        </div>
      </div>
    </>
  )
};

const JsonEditor = ({ jsonString, handleJsonChange, jsonError, t }: any) => ( // Receive t as prop
  <div className="flex flex-col h-full flex-grow pt-2">
    <textarea
      className="w-full h-full flex-grow bg-gray-900/80 text-gray-200 p-4 rounded-lg border border-gray-700 font-mono text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-none custom-scrollbar transition-colors"
      value={jsonString}
      onChange={handleJsonChange}
      spellCheck={false}
    />
    {jsonError && (
      <div className="mt-3 p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-red-300 text-sm flex items-start gap-2">
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <div>
            <strong className="block mb-1">{t('sentenceEditor.jsonErrorHeader')}</strong>
            <span className="font-mono text-xs">{jsonError}</span>
        </div>
      </div>
    )}
  </div>
);

interface ResizableWordBlockProps {
    index: number;
    token: LyricToken;
    lineStartTime: number;
    lineDuration: number;
    timelineWidth: number;
    onTimeUpdate: (tokenIndex: number, type: 'move' | 'resize-left' | 'resize-right', newStartTime: number, newEndTime: number) => void;
    onDelete: () => void;
    onSelect: () => void;
    isSelected: boolean;
    isPlaying: boolean;
    deleteMode: boolean;
}

function ResizableWordBlock({ index, token, lineStartTime, lineDuration, timelineWidth, onTimeUpdate, onDelete, onSelect, isSelected, isPlaying, deleteMode }: ResizableWordBlockProps) {
    const [dragState, setDragState] = useState({ x: 0, width: 0 });
    const isDraggingRef = useRef(false);
    
    const timeToPx = (time: number) => {
      const duration = lineDuration > 0 ? lineDuration : 1; 
      return ((time - lineStartTime) / duration) * timelineWidth;
    }
    const pxToTime = (px: number) => {
      const duration = lineDuration > 0 ? lineDuration : 1;
      return (px / timelineWidth) * duration;
    }

    useEffect(() => {
      if (timelineWidth > 0 && !isDraggingRef.current) {
        setDragState({
            x: timeToPx(token.startTime),
            width: timeToPx(token.endTime) - timeToPx(token.startTime)
        });
      }
    }, [token.startTime, token.endTime, lineStartTime, lineDuration, timelineWidth]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, type: 'move' | 'resize-left' | 'resize-right') => {
        e.preventDefault();
        e.stopPropagation();
        if (deleteMode) return;
        
        onSelect(); // Ensure it's selected when starting interaction
        isDraggingRef.current = true;
        useMobileViewStore.getState().setSwipeDisabled(true);
        
        const startX = e.clientX;
        const initialDragState = { ...dragState };
        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);

        const onPointerMove = (moveEvent: PointerEvent) => {
            const deltaX = moveEvent.clientX - startX;
            
            setDragState(prev => {
                let newX = initialDragState.x;
                let newWidth = initialDragState.width;

                if (type === 'move') {
                    newX = initialDragState.x + deltaX;
                    // Clamp move to container boundaries
                    if (newX < 0) {
                        newX = 0;
                    } else if (newX + newWidth > timelineWidth) {
                        newX = timelineWidth - newWidth;
                    }
                } else if (type === 'resize-left') {
                    newX = initialDragState.x + deltaX;
                    newWidth = initialDragState.width - deltaX;
                    
                    if (newX < 0) {
                        newWidth = initialDragState.width + initialDragState.x;
                        newX = 0;
                    }
                } else if (type === 'resize-right') {
                    newWidth = initialDragState.width + deltaX;
                    if (initialDragState.x + newWidth > timelineWidth) {
                        newWidth = timelineWidth - initialDragState.x;
                    }
                }

                // Prevent negative or tiny width
                if (newWidth < 4) {
                    if (type === 'resize-left') {
                        newX = initialDragState.x + initialDragState.width - 4;
                    }
                    newWidth = 4;
                }

                return { x: newX, width: newWidth };
            });
        };

        const onPointerUp = (upEvent: PointerEvent) => {
            target.releasePointerCapture(upEvent.pointerId);
            target.removeEventListener('pointermove', onPointerMove);
            target.removeEventListener('pointerup', onPointerUp);
            target.removeEventListener('pointercancel', onPointerUp);
            
            isDraggingRef.current = false;
            useMobileViewStore.getState().setSwipeDisabled(false);
            
            const deltaX = upEvent.clientX - startX;
            let finalX = initialDragState.x;
            let finalWidth = initialDragState.width;
            
            if (type === 'move') {
                finalX = initialDragState.x + deltaX;
                if (finalX < 0) finalX = 0;
                else if (finalX + finalWidth > timelineWidth) finalX = timelineWidth - finalWidth;
            } else if (type === 'resize-left') {
                finalX = initialDragState.x + deltaX;
                finalWidth = initialDragState.width - deltaX;
                if (finalX < 0) {
                    finalWidth = initialDragState.width + initialDragState.x;
                    finalX = 0;
                }
            } else if (type === 'resize-right') {
                finalWidth = initialDragState.width + deltaX;
                if (initialDragState.x + finalWidth > timelineWidth) {
                    finalWidth = timelineWidth - initialDragState.x;
                }
            }
            
            if (finalWidth < 4) {
                if (type === 'resize-left') finalX = initialDragState.x + initialDragState.width - 4;
                finalWidth = 4;
            }

            // Ensure we don't go out of bounds of the actual line time
            const calculatedStart = lineStartTime + pxToTime(finalX);
            const calculatedEnd = lineStartTime + pxToTime(finalX + finalWidth);
            
            const newStartTime = Math.max(lineStartTime, Math.min(calculatedStart, lineStartTime + lineDuration));
            const newEndTime = Math.max(lineStartTime, Math.min(calculatedEnd, lineStartTime + lineDuration));

            onTimeUpdate(index, type, newStartTime, newEndTime);
        };

        target.addEventListener('pointermove', onPointerMove);
        target.addEventListener('pointerup', onPointerUp);
        target.addEventListener('pointercancel', onPointerUp);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (deleteMode) onDelete();
        else onSelect();
    };

    return (
        <div style={{ left: dragState.x, width: dragState.width, zIndex: isSelected ? 20 : 10 }} onClick={handleClick}
            className={cn(
                "word-block absolute top-1/2 -translate-y-1/2 h-10 rounded-md border-2 flex justify-center items-center text-sm font-bold text-white select-none shadow-sm",
                isPlaying 
                    ? "bg-yellow-400 border-yellow-600 text-black scale-[1.02]" 
                    : isSelected 
                        ? "bg-blue-600 border-blue-400" 
                        : "bg-green-600 border-green-500",
                deleteMode 
                    ? "cursor-not-allowed bg-red-500 border-red-700" 
                    : "cursor-pointer"
            )}
            title={token.surface}
        >
            <div className="relative w-full h-full flex items-center justify-center">
              <span className="pointer-events-none truncate px-1">{index + 1}</span>
            </div>
            {isSelected && !deleteMode && (
              <>
                <div onPointerDown={(e) => handlePointerDown(e, 'resize-left')} className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-30 flex items-center justify-center group/left"><div className="w-1 h-4 bg-white/40 group-hover/left:bg-white rounded-full pointer-events-none transition-colors"></div></div>
                <div onPointerDown={(e) => handlePointerDown(e, 'move')} className="absolute inset-y-0 left-3 right-3 cursor-move z-20" />
                <div onPointerDown={(e) => handlePointerDown(e, 'resize-right')} className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-30 flex items-center justify-center group/right"><div className="w-1 h-4 bg-white/40 group-hover/right:bg-white rounded-full pointer-events-none transition-colors"></div></div>
              </>
            )}
        </div>
    );
};

export default SentenceEditor;
