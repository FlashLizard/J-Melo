// src/components/editor/LyricsEditor.tsx
import React, { useState, useEffect } from 'react';
import { LyricToken, LyricLine } from '@/lib/mock-data';

interface Props {
  token: LyricToken;
  line: LyricLine;
  lyrics: LyricLine[];
  onSave: (updatedToken: LyricToken) => void;
  onCancel: () => void;
}

const LyricsEditor: React.FC<Props> = ({ token, line, lyrics, onSave, onCancel }) => {
  const [surface, setSurface] = useState(token.surface);
  const [reading, setReading] = useState(token.reading);
  const [startTime, setStartTime] = useState(token.startTime.toFixed(2));
  const [endTime, setEndTime] = useState(token.endTime.toFixed(2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSurface(token.surface);
    setReading(token.reading);
    setStartTime(token.startTime.toFixed(2));
    setEndTime(token.endTime.toFixed(2));
    setError(null);
  }, [token.startTime]);

  const handleSave = () => {
    setError(null);
    const newStartTime = parseFloat(startTime);
    const newEndTime = parseFloat(endTime);

    if (newStartTime >= newEndTime) {
      setError("Start time must be before end time.");
      return;
    }

    const tokenIndex = line.tokens.findIndex(t => t.startTime === token.startTime);
    
    // Check for overlap with the previous token in the same line
    if (tokenIndex > 0) {
      const prevToken = line.tokens[tokenIndex - 1];
      if (newStartTime < prevToken.endTime) {
        setError(`Time overlap with previous word "${prevToken.surface}". Start time must be >= ${prevToken.endTime.toFixed(2)}.`);
        return;
      }
    }

    // Check for overlap with the next token in the same line
    if (tokenIndex < line.tokens.length - 1) {
      const nextToken = line.tokens[tokenIndex + 1];
      if (newEndTime > nextToken.startTime) {
        setError(`Time overlap with next word "${nextToken.surface}". End time must be <= ${nextToken.startTime.toFixed(2)}.`);
        return;
      }
    }

    onSave({
      ...token,
      surface,
      reading,
      startTime: newStartTime,
      endTime: newEndTime,
    });
  };

  return (
    <div className="h-full bg-gray-800 text-white p-4 flex flex-col">
      <h2 className="text-xl font-bold mb-4">Edit Word</h2>
      <div className="space-y-4 flex-grow">
        {error && <p className="text-red-500 bg-red-900 p-2 rounded">{error}</p>}
        <div>
          <label htmlFor="surface" className="block text-sm font-medium mb-1">
            Surface
          </label>
          <input
            type="text"
            id="surface"
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 border border-gray-600"
          />
        </div>
        <div>
          <label htmlFor="reading" className="block text-sm font-medium mb-1">
            Reading (Hiragana)
          </label>
          <input
            type="text"
            id="reading"
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 border border-gray-600"
          />
        </div>
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium mb-1">
            Start Time (s)
          </label>
          <input
            type="number"
            step="0.01"
            id="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 border border-gray-600"
          />
        </div>
        <div>
          <label htmlFor="endTime" className="block text-sm font-medium mb-1">
            End Time (s)
          </label>
          <input
            type="number"
            step="0.01"
            id="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 border border-gray-600"
          />
        </div>
      </div>
      <div className="flex space-x-2 mt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 w-full"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 w-full"
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default LyricsEditor;
