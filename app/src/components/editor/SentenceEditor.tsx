// app/src/components/editor/SentenceEditor.tsx
import EditableWordRow from './EditableWordRow';
import { LyricLine, LyricToken } from '@/interfaces/lyrics';
import Draggable from 'react-draggable';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

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

  useEffect(() => {
    setCurrentLine(line);
    setSelectedTokenIndex(null);
  }, [line]);

  useEffect(() => {
    const handleResize = () => {
      if (timelineRef.current) setTimelineWidth(timelineRef.current.offsetWidth);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const lineDuration = useMemo(() => currentLine.endTime - currentLine.startTime, [currentLine]);

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = currentLine.startTime;
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play();
      setIsAudioPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentAudioTime(time);
      const activeIndex = currentLine.tokens.findIndex(t => time >= t.startTime && time < t.endTime);
      setActiveTokenIndex(activeIndex);
      if (time >= currentLine.endTime) handleStop();
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
      setCurrentAudioTime(currentLine.startTime);
      setActiveTokenIndex(null);
    }
  };

  const handlePlaybackRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPlaybackRate(Number(e.target.value));
    if (audioRef.current) audioRef.current.playbackRate = Number(e.target.value);
  };
  
  const handleTimeUpdate = useCallback((index: number, type: 'move' | 'resize-left' | 'resize-right', newStart: number, newEnd: number) => {
    setCurrentLine(prevLine => {
        const newTokens = [...prevLine.tokens];
        const minDuration = 0.05;

        // Ensure minimum duration on the active token
        if (newEnd - newStart < minDuration) {
            if (type === 'resize-left' || (type === 'move' && newStart < newTokens[index].startTime)) {
                newStart = newEnd - minDuration;
            } else {
                newEnd = newStart + minDuration;
            }
        }
        
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
        } else if (type === 'resize-right') {
            const nextToken = newTokens[index + 1];
            if (nextToken && newEnd > nextToken.startTime) {
                newTokens[index + 1] = { ...nextToken, startTime: newEnd };
            }
             newEnd = Math.min(newEnd, nextToken ? nextToken.endTime : prevLine.endTime);

        } else if (type === 'resize-left') {
            const prevToken = newTokens[index - 1];
            if (prevToken && newStart < prevToken.endTime) {
                newTokens[index - 1] = { ...prevToken, endTime: newStart };
            }
            newStart = Math.max(newStart, prevToken ? prevToken.startTime : prevLine.startTime);
        }

        newTokens[index] = { ...newTokens[index], startTime: newStart, endTime: newEnd };
        
        // Final validation pass to ensure no blocks are smaller than minDuration after erosion
        for(let i = 0; i < newTokens.length; i++) {
            if (newTokens[i].endTime - newTokens[i].startTime < minDuration) {
                if (i < newTokens.length - 1 && newTokens[i+1].startTime - newTokens[i].startTime >= minDuration) {
                    newTokens[i].endTime = newTokens[i].startTime + minDuration;
                } else if (i > 0 && newTokens[i].endTime - newTokens[i-1].endTime >= minDuration) {
                     newTokens[i].startTime = newTokens[i].endTime - minDuration;
                }
            }
        }

        return { ...prevLine, tokens: newTokens.sort((a,b) => a.startTime - b.startTime) };
    });
  }, []);

  const handleTokenChange = useCallback((index: number, field: keyof LyricToken, value: any) => {
      const token = currentLine.tokens[index];
      if (field === 'startTime' || field === 'endTime') {
          const newStartTime = field === 'startTime' ? Number(value) : token.startTime;
          const newEndTime = field === 'endTime' ? Number(value) : token.endTime;
          handleTimeUpdate(index, 'move', newStartTime, newEndTime)
      } else {
           setCurrentLine(prevLine => {
              const newTokens = [...prevLine.tokens];
              newTokens[index] = { ...newTokens[index], [field]: value };
              return { ...prevLine, tokens: newTokens };
          });
      }
  }, [currentLine.tokens, handleTimeUpdate]);


  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (addMode) {
      if (!timelineRef.current || (e.target as HTMLElement).closest('.word-block')) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickTime = currentLine.startTime + (clickX / timelineWidth) * lineDuration;
      const newToken: LyricToken = { surface: 'new', reading: 'new', romaji: 'new', startTime: clickTime, endTime: Math.min(clickTime + 0.5, currentLine.endTime), partOfSpeech: 'noun' };
      setCurrentLine(prevLine => ({ ...prevLine, tokens: [...prevLine.tokens, newToken].sort((a, b) => a.startTime - b.startTime) }));
      setAddMode(false);
    } else {
        setSelectedTokenIndex(null); // Deselect on timeline click
    }
  };

  const handleDeleteToken = (tokenIndex: number) => {
    setCurrentLine(prevLine => ({
      ...prevLine,
      tokens: prevLine.tokens.filter((_, index) => index !== tokenIndex),
    }));
    setDeleteMode(false);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col">
      <h2 className="text-white text-xl font-bold mb-4">Sentence Editor</h2>
      <div className="flex justify-end space-x-2 mb-4">
        <button onClick={() => { setAddMode(!addMode); setDeleteMode(false); }} className={`p-2 rounded-full ${addMode ? 'bg-green-500' : 'bg-gray-600'} hover:bg-green-500 text-white`} title="Add Word"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg></button>
        <button onClick={() => { setDeleteMode(!deleteMode); setAddMode(false); }} className={`p-2 rounded-full ${deleteMode ? 'bg-red-500' : 'bg-gray-600'} hover:bg-red-500 text-white`} title="Delete Word"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></button>
      </div>
      <div ref={timelineRef} className={`flex-grow border border-gray-700 rounded-lg p-2 relative h-24 mb-4 overflow-hidden ${addMode ? 'cursor-crosshair' : ''}`} onClick={handleTimelineClick}>
        {timelineWidth > 0 && currentLine.tokens.map((token, index) => (
            <ResizableWordBlock key={index} index={index} token={token} lineStartTime={currentLine.startTime} lineDuration={lineDuration} timelineWidth={timelineWidth} onTimeUpdate={handleTimeUpdate} onDelete={() => handleDeleteToken(index)} isPlaying={activeTokenIndex === index} deleteMode={deleteMode} isSelected={selectedTokenIndex === index} onSelect={() => setSelectedTokenIndex(index)} />
        ))}
      </div>
      <div className="flex-grow overflow-y-auto space-y-2 pr-2">
        <div className="grid grid-cols-5 gap-2 items-center p-2 text-white text-sm font-bold"><div>#</div><div>Surface</div><div>Reading</div><div>Start (s)</div><div>End (s)</div></div>
        {currentLine.tokens.map((token, index) => (<EditableWordRow key={index} index={index} token={token} onTokenChange={handleTokenChange}/>))}
      </div>
      <div className="flex items-center justify-center space-x-4 mt-auto pt-4">
        <button onClick={isAudioPlaying ? handleStop : handlePlay} className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white" title={isAudioPlaying ? 'Stop' : 'Play'}>{isAudioPlaying ? 'Stop' : 'Play'}</button>
        <select value={playbackRate} onChange={handlePlaybackRateChange} className="p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"><option value={0.5}>0.5x</option><option value={0.75}>0.75x</option><option value={1}>1x</option><option value={1.25}>1.25x</option><option value={1.5}>1.5x</option></select>
      </div>
      <div className="mt-4 flex justify-end space-x-2">
        <button onClick={() => onSave(currentLine)} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 text-white">Save</button>
        <button onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-white">Cancel</button>
      </div>
      <audio ref={audioRef} src={songAudioUrl} preload="auto" onTimeUpdate={handleAudioTimeUpdate} onEnded={handleStop} />
    </div>
  );
};

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

const ResizableWordBlock: React.FC<ResizableWordBlockProps> = ({ index, token, lineStartTime, lineDuration, timelineWidth, onTimeUpdate, onDelete, onSelect, isSelected, isPlaying, deleteMode }) => {
    const moveRef = useRef(null);
    const leftRef = useRef(null);
    const rightRef = useRef(null);

    const timeToPx = (time: number) => ((time - lineStartTime) / lineDuration) * timelineWidth;
    const pxToTime = (px: number) => (px / timelineWidth) * lineDuration;

    const x = timeToPx(token.startTime);
    const width = timeToPx(token.endTime) - x;

    const handleDrag = (e: any, data: any) => {
        const newStartTime = token.startTime + pxToTime(data.deltaX);
        const newEndTime = token.endTime + pxToTime(data.deltaX);
        onTimeUpdate(index, 'move', newStartTime, newEndTime);
    };
    
    const handleResize = (e: any, data: any, edge: 'left' | 'right') => {
        if (edge === 'left') {
            const newStartTime = token.startTime + pxToTime(data.deltaX);
            onTimeUpdate(index, 'resize-left', newStartTime, token.endTime);
        } else {
            const newEndTime = token.endTime + pxToTime(data.deltaX);
            onTimeUpdate(index, 'resize-right', token.startTime, newEndTime);
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (deleteMode) onDelete();
        else onSelect();
    };

    return (
        <div style={{ left: x, width: width, zIndex: isSelected ? 20 : 10 }} onClick={handleClick}
            className={`word-block absolute top-1/2 -translate-y-1/2 h-10 rounded-md border-2 flex justify-center items-center text-sm font-bold text-white select-none
                ${isPlaying ? 'bg-yellow-400 border-yellow-600' : 'bg-green-500 border-green-700'} 
                ${isSelected ? 'border-blue-400' : ''}
                ${deleteMode ? 'cursor-not-allowed bg-red-500' : 'cursor-pointer'}`}
            title={token.surface}
        >
            <span className="pointer-events-none">{index + 1}</span>
            {isSelected && !deleteMode && (
              <>
                <Draggable nodeRef={leftRef} axis="x" onDrag={(e, data) => handleResize(e, data, 'left')}>
                  <div ref={leftRef} className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-30" />
                </Draggable>
                <Draggable nodeRef={moveRef} axis="x" onDrag={handleDrag}>
                  <div ref={moveRef} className="absolute inset-0 cursor-move z-20" />
                </Draggable>
                <Draggable nodeRef={rightRef} axis="x" onDrag={(e, data) => handleResize(e, data, 'right')}>
                  <div ref={rightRef} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-30" />
                </Draggable>
              </>
            )}
        </div>
    );
};

export default SentenceEditor;