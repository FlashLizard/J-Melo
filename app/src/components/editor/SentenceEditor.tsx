// app/src/components/editor/SentenceEditor.tsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { LyricLine, LyricToken } from '@/interfaces/lyrics';
import Draggable from 'react-draggable';

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
  const audioRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(0);

  const [editingField, setEditingField] = useState<{ id: string; field: 'surface' | 'reading' } | null>(null);

  useEffect(() => {
    setCurrentLine(line);
  }, [line]);

  useEffect(() => {
    const handleResize = () => {
      if (timelineRef.current) {
        setTimelineWidth(timelineRef.current.offsetWidth);
      }
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
      setCurrentAudioTime(audioRef.current.currentTime);
      if (audioRef.current.currentTime >= currentLine.endTime) {
        handleStop();
      }
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
      setCurrentAudioTime(currentLine.startTime);
    }
  };

  const handlePlaybackRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPlaybackRate(Number(e.target.value));
    if (audioRef.current) {
      audioRef.current.playbackRate = Number(e.target.value);
    }
  };

  const handleWordDoubleClick = useCallback((tokenId: string, field: 'surface' | 'reading') => {
    setEditingField({ id: tokenId, field });
  }, []);

  const handleWordChange = useCallback((tokenId: string, field: 'surface' | 'reading', value: string) => {
    setCurrentLine(prevLine => ({
      ...prevLine,
      tokens: prevLine.tokens.map(token => {
        if (token.surface + token.startTime === tokenId) {
          return { ...token, [field]: value };
        }
        return token;
      }),
    }));
  }, []);

  const handleTokenTimeUpdate = useCallback((tokenId: string, newStartTime: number, newEndTime: number) => {
    setCurrentLine(prevLine => {
      const newTokens = prevLine.tokens.map(token => {
        if (token.surface + token.startTime === tokenId) {
          return { ...token, startTime: newStartTime, endTime: newEndTime };
        }
        return token;
      });
      return { ...prevLine, tokens: newTokens };
    });
  }, []);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (addMode) {
      if (!timelineRef.current || (e.target as HTMLElement).closest('.word-block')) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickTime = currentLine.startTime + (clickX / timelineWidth) * lineDuration;

      const newToken: LyricToken = {
        surface: 'new',
        reading: 'new',
        romaji: 'new',
        startTime: clickTime,
        endTime: Math.min(clickTime + 0.5, currentLine.endTime),
        partOfSpeech: 'noun',
      };

      setCurrentLine(prevLine => {
        const newTokens = [...prevLine.tokens, newToken].sort((a, b) => a.startTime - b.startTime);
        return { ...prevLine, tokens: newTokens };
      });
      setAddMode(false);
    }
  };

  const handleDeleteToken = (tokenId: string) => {
    setCurrentLine(prevLine => ({
      ...prevLine,
      tokens: prevLine.tokens.filter(token => (token.surface + token.startTime) !== tokenId),
    }));
    setDeleteMode(false);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col">
      <h2 className="text-white text-xl font-bold mb-4">Sentence Editor</h2>

      <div className="flex justify-end space-x-2 mb-4">
        <button
          onClick={() => { setAddMode(!addMode); setDeleteMode(false); }}
          className={`p-2 rounded-full ${addMode ? 'bg-green-500' : 'bg-gray-600'} hover:bg-green-500 text-white`}
          title="Add Word"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button
          onClick={() => { setDeleteMode(!deleteMode); setAddMode(false); }}
          className={`p-2 rounded-full ${deleteMode ? 'bg-red-500' : 'bg-gray-600'} hover:bg-red-500 text-white`}
          title="Delete Word"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
      </div>

      <div 
        ref={timelineRef} 
        className={`flex-grow border border-gray-700 rounded-lg p-2 relative h-40 mb-4 overflow-hidden ${addMode ? 'cursor-crosshair' : ''}`}
        onClick={handleTimelineClick}
      >
        {timelineWidth > 0 && currentLine.tokens.map((token, index) => {
          const prevToken = currentLine.tokens[index - 1];
          const nextToken = currentLine.tokens[index + 1];
          const minAllowedStartTime = prevToken ? prevToken.endTime : currentLine.startTime;
          const maxAllowedEndTime = nextToken ? nextToken.startTime : currentLine.endTime;

          return (
            <ResizableWordBlock
              key={token.surface + token.startTime}
              token={token}
              lineStartTime={currentLine.startTime}
              lineDuration={lineDuration}
              timelineWidth={timelineWidth}
              isEditing={editingField}
              onDoubleClick={handleWordDoubleClick}
              onChange={handleWordChange}
              onTimeUpdate={handleTokenTimeUpdate}
              onDelete={() => handleDeleteToken(token.surface + token.startTime)}
              isPlaying={isAudioPlaying && currentAudioTime >= token.startTime && currentAudioTime < token.endTime}
              minAllowedStartTime={minAllowedStartTime}
              maxAllowedEndTime={maxAllowedEndTime}
              deleteMode={deleteMode}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-center space-x-4 mt-auto">
        <button
          onClick={isAudioPlaying ? handleStop : handlePlay}
          className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white"
          title={isAudioPlaying ? 'Stop' : 'Play'}
        >
          {isAudioPlaying ? 'Stop' : 'Play'}
        </button>
        <select
          value={playbackRate}
          onChange={handlePlaybackRateChange}
          className="p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={0.5}>0.5x</option>
          <option value={0.75}>0.75x</option>
          <option value={1}>1x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
        </select>
      </div>

      <div className="mt-4 flex justify-end space-x-2">
        <button
          onClick={() => onSave(currentLine)}
          className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 text-white"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-white"
        >
          Cancel
        </button>
      </div>

      <audio ref={audioRef} src={songAudioUrl} preload="auto" onTimeUpdate={handleAudioTimeUpdate} onEnded={handleStop} />
    </div>
  );
};

interface ResizableWordBlockProps {
    token: LyricToken;
    lineStartTime: number;
    lineDuration: number;
    timelineWidth: number;
    isEditing: { id: string; field: 'surface' | 'reading' } | null;
    onDoubleClick: (tokenId: string, field: 'surface' | 'reading') => void;
    onChange: (tokenId: string, field: 'surface' | 'reading', value: string) => void;
    onTimeUpdate: (tokenId: string, newStartTime: number, newEndTime: number) => void;
    onDelete: () => void;
    isPlaying: boolean;
    minAllowedStartTime: number;
    maxAllowedEndTime: number;
    deleteMode: boolean;
}

const ResizableWordBlock: React.FC<ResizableWordBlockProps> = ({
    token,
    lineStartTime,
    lineDuration,
    timelineWidth,
    isEditing,
    onDoubleClick,
    onChange,
    onTimeUpdate,
    onDelete,
    isPlaying,
    minAllowedStartTime,
    maxAllowedEndTime,
    deleteMode,
}) => {
    const tokenUniqueId = token.surface + token.startTime;
    const blockRef = useRef(null);

    const position = {
        x: ((token.startTime - lineStartTime) / lineDuration) * timelineWidth,
        y: 0
    };
    
    const blockWidth = ((token.endTime - token.startTime) / lineDuration) * timelineWidth;

    const onStop = (e: any, data: any) => {
        const newStartTime = lineStartTime + (data.x / timelineWidth) * lineDuration;
        const newEndTime = newStartTime + ((data.lastX - data.x + blockWidth) / timelineWidth) * lineDuration;
        
        let constrainedStartTime = Math.max(newStartTime, minAllowedStartTime);
        let constrainedEndTime = Math.min(newEndTime, maxAllowedEndTime);
        
        if (constrainedStartTime >= constrainedEndTime) {
            constrainedEndTime = constrainedStartTime + 0.1;
        }

        onTimeUpdate(tokenUniqueId, constrainedStartTime, constrainedEndTime);
    };

    const currentField = isEditing?.id === tokenUniqueId && isEditing.field;

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (deleteMode) {
        onDelete();
      }
    }

    return (
        <Draggable
            nodeRef={blockRef}
            axis="x"
            position={position}
            onStop={onStop}
            bounds="parent"
        >
            <div
                ref={blockRef}
                className={`word-block absolute top-1/2 -translate-y-1/2 h-12 bg-green-500 rounded-lg border-2 border-green-700 flex flex-col justify-center items-center text-xs font-mono select-none
                ${isPlaying ? 'bg-green-300' : ''} ${deleteMode ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                style={{ width: `${blockWidth}px` }}
                onClick={handleClick}
                onDoubleClick={(e) => {
                    if (e.clientY < e.currentTarget.getBoundingClientRect().top + e.currentTarget.offsetHeight / 2) {
                        onDoubleClick(tokenUniqueId, 'reading');
                    } else {
                        onDoubleClick(tokenUniqueId, 'surface');
                    }
                }}
            >
                {currentField === 'reading' ? (
                    <input
                        type="text"
                        value={token.reading}
                        onChange={(e) => onChange(tokenUniqueId, 'reading', e.target.value)}
                        onBlur={() => onDoubleClick('', 'reading')}
                        autoFocus
                        className="w-full text-center bg-gray-700 text-white rounded"
                    />
                ) : (
                    <span className="text-gray-200">{token.reading}</span>
                )}
                {currentField === 'surface' ? (
                    <input
                        type="text"
                        value={token.surface}
                        onChange={(e) => onChange(tokenUniqueId, 'surface', e.target.value)}
                        onBlur={() => onDoubleClick('', 'surface')}
                        autoFocus
                        className="w-full text-center bg-gray-700 text-white rounded mt-1"
                    />
                ) : (
                    <span className="text-white mt-1">{token.surface}</span>
                )}
            </div>
        </Draggable>
    );
};

export default SentenceEditor;