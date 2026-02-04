// app/src/components/editor/SentenceEditor.tsx
import EditableWordRow from './EditableWordRow';
import { LyricLine, LyricToken } from '@/interfaces/lyrics';
import Draggable from 'react-draggable';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

const MemoizedResizableWordBlock = React.memo(ResizableWordBlock);
const MemoizedEditableWordRow = React.memo(EditableWordRow);

interface SentenceEditorProps {
  line: LyricLine;
  onSave: (updatedLine: LyricLine) => void;
  onCancel: () => void;
  relativeAudioUrl: string;
}

const SentenceEditor: React.FC<SentenceEditorProps> = ({ line, onSave, onCancel, relativeAudioUrl }) => {
  const BACKEND_URL = 'http://localhost:8000';
  const songAudioUrl = `${BACKEND_URL}${relativeAudioUrl}`;
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
  const animationFrameRef = useRef<number>();

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
      
      const newToken: LyricToken = { surface: 'new', reading: 'new', romaji: 'new', startTime: clickTime, endTime: Math.min(clickTime + 0.5, currentLine.endTime), partOfSpeech: 'noun' };
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
      setCurrentLine(parsed);
      setJsonError(null);
    } catch (error) {
      setJsonError((error as Error).message);
    }
  };

  const handleSaveClick = () => {
    if (jsonError) {
      alert(`Cannot save due to invalid JSON: ${jsonError}`);
      return;
    }
    onSave(currentLine);
  };
  
  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Sentence Editor</h2>
        <div className="flex space-x-1 bg-gray-700 rounded-lg p-1">
          <button onClick={() => setEditorMode('visual')} className={`px-3 py-1 rounded-md text-sm ${editorMode === 'visual' ? 'bg-green-600 text-white' : 'text-gray-300'}`}>Visual</button>
          <button onClick={() => setEditorMode('json')} className={`px-3 py-1 rounded-md text-sm ${editorMode === 'json' ? 'bg-green-600 text-white' : 'text-gray-300'}`}>JSON</button>
        </div>
      </div>
      
      <div className="flex-grow flex flex-col min-h-0">
        {editorMode === 'visual' ? 
          <VisualEditor 
            {...{
              addMode, setAddMode, deleteMode, setDeleteMode, timelineRef, timelineWidth, 
              currentLine, lineDuration, handleTimelineClick, activeTokenIndex, selectedTokenIndex, 
              setSelectedTokenIndex, handleTimeUpdate, handleDeleteToken, handleTokenChange,
              currentAudioTime, handleScrubberChange, setIsScrubbing, handlePlay,
              THUMB_WIDTH_PX, THUMB_HALF_WIDTH_PX
            }}
          /> : 
          <JsonEditor jsonString={jsonString} handleJsonChange={handleJsonChange} jsonError={jsonError} />}
      </div>
      
      <div className="flex items-center justify-center space-x-4 mt-auto pt-4">
        <button onClick={isAudioPlaying ? handleStop : handlePlay} className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white" title={isAudioPlaying ? 'Stop' : 'Play'}>{isAudioPlaying ? 'Stop' : 'Play'}</button>
        <select value={playbackRate} onChange={handlePlaybackRateChange} className="p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"><option value={0.5}>0.5x</option><option value={0.75}>0.75x</option><option value={1}>1x</option><option value={1.25}>1.25x</option><option value={1.5}>1.5x</option></select>
      </div>
      <div className="mt-4 flex justify-end space-x-2">
        <button onClick={handleSaveClick} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 text-white disabled:opacity-50" disabled={jsonError !== null}>Save</button>
        <button onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-white">Cancel</button>
      </div>
      <audio ref={audioRef} src={songAudioUrl} preload="auto" />
    </div>
  );
};

const VisualEditor = ({
  addMode, setAddMode, deleteMode, setDeleteMode, timelineRef, timelineWidth, 
  currentLine, lineDuration, handleTimelineClick, activeTokenIndex, selectedTokenIndex, 
  setSelectedTokenIndex, handleTimeUpdate, handleDeleteToken, handleTokenChange,
  currentAudioTime, handleScrubberChange, setIsScrubbing, handlePlay,
  THUMB_WIDTH_PX, THUMB_HALF_WIDTH_PX
}: any) => {
  const effectiveTimelineWidth = timelineWidth - THUMB_WIDTH_PX;
  const progressPercent = lineDuration > 0 ? ((currentAudioTime - currentLine.startTime) / lineDuration) * 100 : 0;
  return (
    <>
      <div className="flex justify-end space-x-2 mb-4">
        <button onClick={() => { setAddMode(!addMode); setDeleteMode(false); }} className={`p-2 rounded-full ${addMode ? 'bg-green-500' : 'bg-gray-600'} hover:bg-green-500 text-white`} title="Add Word"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg></button>
        <button onClick={() => { setDeleteMode(!deleteMode); setAddMode(false); }} className={`p-2 rounded-full ${deleteMode ? 'bg-red-500' : 'bg-gray-600'} hover:bg-red-500 text-white`} title="Delete Word"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></button>
      </div>
      
      <div className="px-1 sm:px-4">
        <div 
          ref={timelineRef} 
          className="border border-gray-700 rounded-lg relative h-24 overflow-hidden" 
          onClick={handleTimelineClick}
          style={{ paddingLeft: `${THUMB_HALF_WIDTH_PX}px`, paddingRight: `${THUMB_HALF_WIDTH_PX}px` }}
        >
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
          <div 
            className="absolute top-0 w-px h-full bg-yellow-400 opacity-50 pointer-events-none z-30"
            style={{ left: `${progressPercent}%` }} 
          />
        </div>
        <input
            type="range"
            min={currentLine.startTime}
            max={currentLine.endTime}
            step={0.01}
            value={currentAudioTime}
            onMouseDown={() => setIsScrubbing(true)}
            onMouseUp={() => { setIsScrubbing(false); if (handlePlay) handlePlay(); }}
            onChange={(e) => handleScrubberChange(parseFloat(e.target.value))}
            className="w-full mt-2"
        />
        <div className="flex justify-between text-xs text-gray-400 font-mono mt-1" style={{ paddingLeft: `${THUMB_HALF_WIDTH_PX}px`, paddingRight: `${THUMB_HALF_WIDTH_PX}px` }}>
          <span>{currentLine.startTime.toFixed(2)}s</span>
          <span>{currentLine.endTime.toFixed(2)}s</span>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto overflow-x-auto space-y-2 pr-2 mt-4">
        <div className="grid grid-cols-5 gap-x-2 items-center p-2 text-white text-xs sm:text-sm font-bold min-w-[500px]">
          <div className="col-span-1">#</div>
          <div className="col-span-1">Surface</div>
          <div className="col-span-1">Reading</div>
          <div className="col-span-1">Start (s)</div>
          <div className="col-span-1">End (s)</div>
        </div>
        {currentLine.tokens.map((token: LyricToken, index: number) => (<MemoizedEditableWordRow key={`${token.startTime}-${token.surface}`} index={index} token={token} onTokenChange={handleTokenChange}/>))}
      </div>
    </>
  )
};

const JsonEditor = ({ jsonString, handleJsonChange, jsonError }: any) => (
  <div className="flex flex-col h-full flex-grow">
    <textarea
      className="w-full h-full flex-grow bg-gray-900 text-white p-2 rounded border border-gray-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      value={jsonString}
      onChange={handleJsonChange}
    />
    {jsonError && (
      <div className="mt-2 p-2 bg-red-800 border border-red-600 rounded text-red-200 text-sm">
        <strong>JSON Error:</strong> {jsonError}
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
    const moveRef = useRef(null);
    const leftRef = useRef(null);
    const rightRef = useRef(null);
    const [dragState, setDragState] = useState({ x: 0, width: 0 });
    const timeToPx = (time: number) => {
      if (lineDuration <= 0) return 0;
      return ((time - lineStartTime) / lineDuration) * timelineWidth;
    }
    const pxToTime = (px: number) => (px / timelineWidth) * lineDuration;

    useEffect(() => {
      if (lineDuration > 0 && timelineWidth > 0) {
        setDragState({
            x: timeToPx(token.startTime),
            width: timeToPx(token.endTime) - timeToPx(token.startTime)
        });
      }
    }, [token.startTime, token.endTime, lineStartTime, lineDuration, timelineWidth]);

    const handleDrag = (e: any, data: any) => {
        setDragState(prev => ({ ...prev, x: prev.x + data.deltaX }));
    };
    
    const handleResize = (e: any, data: any, edge: 'left' | 'right') => {
        if (edge === 'left') {
            setDragState(prev => ({ x: prev.x + data.deltaX, width: prev.width - data.deltaX }));
        } else {
            setDragState(prev => ({ ...prev, width: prev.width + data.deltaX }));
        }
    };

    const handleStop = (type: 'move' | 'resize-left' | 'resize-right') => {
        const newStartTime = lineStartTime + pxToTime(dragState.x);
        const newEndTime = lineStartTime + pxToTime(dragState.x + dragState.width);
        onTimeUpdate(index, type, newStartTime, newEndTime);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (deleteMode) onDelete();
        else onSelect();
    };

    return (
        <div style={{ left: dragState.x, width: dragState.width, zIndex: isSelected ? 20 : 10 }} onClick={handleClick}
            className={`word-block absolute top-1/2 -translate-y-1/2 h-10 rounded-md border-2 flex justify-center items-center text-sm font-bold text-white select-none ${isPlaying ? 'bg-yellow-400 border-yellow-600' : 'bg-green-500 border-green-700'} ${isSelected ? 'border-blue-400' : ''} ${deleteMode ? 'cursor-not-allowed bg-red-500' : 'cursor-pointer'}`}
            title={token.surface}
        >
            <div className="relative w-full h-full flex items-center justify-center">
              <span className="pointer-events-none">{index + 1}</span>
            </div>
            {isSelected && !deleteMode && (
              <>
                <Draggable nodeRef={leftRef} axis="x" onDrag={(e, data) => handleResize(e, data, 'left')} onStop={() => handleStop('resize-left')} position={{x:0,y:0}}><div ref={leftRef} className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-30" /></Draggable>
                <Draggable nodeRef={moveRef} axis="x" onDrag={handleDrag} onStop={() => handleStop('move')}><div ref={moveRef} className="absolute inset-0 cursor-move z-20" /></Draggable>
                <Draggable nodeRef={rightRef} axis="x" onDrag={(e, data) => handleResize(e, data, 'right')} onStop={() => handleStop('resize-right')}><div ref={rightRef} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-30" /></Draggable>
              </>
            )}
        </div>
    );
};

export default SentenceEditor;
