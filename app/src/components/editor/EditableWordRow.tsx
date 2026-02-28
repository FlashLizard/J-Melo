// app/src/components/editor/EditableWordRow.tsx
import React, { useState, useEffect } from 'react';
import { LyricToken } from '@/interfaces/lyrics';
import cn from 'classnames';

interface EditableWordRowProps {
  token: LyricToken;
  index: number;
  onTokenChange: (index: number, field: keyof LyricToken, value: any) => void;
}

const EditableWordRow: React.FC<EditableWordRowProps> = ({ token, index, onTokenChange }) => {
  const [startTimeStr, setStartTimeStr] = useState(token.startTime.toFixed(2));
  const [endTimeStr, setEndTimeStr] = useState(token.endTime.toFixed(2));

  // Sync external changes to local state, but only if they differ significantly 
  // to avoid overwriting user typing in progress.
  useEffect(() => {
    if (parseFloat(startTimeStr) !== token.startTime) {
        setStartTimeStr(token.startTime.toFixed(2));
    }
    if (parseFloat(endTimeStr) !== token.endTime) {
        setEndTimeStr(token.endTime.toFixed(2));
    }
  }, [token.startTime, token.endTime]);

  const handleInputChange = (field: keyof LyricToken, value: string) => {
    onTokenChange(index, field, value);
  };

  const handleTimeBlur = (field: 'startTime' | 'endTime', valueStr: string) => {
      let val = parseFloat(valueStr);
      if (isNaN(val)) val = 0;
      
      // Basic sanity checks
      if (field === 'startTime' && val >= token.endTime) {
          val = token.endTime - 0.05;
      }
      if (field === 'endTime' && val <= token.startTime) {
          val = token.startTime + 0.05;
      }
      
      onTokenChange(index, field, val);
      
      // Update local string formatting immediately
      if (field === 'startTime') setStartTimeStr(val.toFixed(2));
      else setEndTimeStr(val.toFixed(2));
  };

  const inputClasses = "w-full bg-gray-900/50 text-gray-200 px-3 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors text-sm font-medium";
  const timeInputClasses = cn(inputClasses, "font-mono text-center");

  return (
    <div className="grid grid-cols-12 gap-3 items-center px-4 py-2.5 rounded-lg bg-gray-800/80 border border-gray-700/50 hover:bg-gray-700/50 transition-colors group">
      <div className="col-span-1 text-gray-500 font-mono text-xs font-bold text-center bg-gray-900/50 rounded py-1 border border-gray-700">
        {index + 1}
      </div>
      <div className="col-span-3">
        <input
          type="text"
          value={token.surface}
          onChange={(e) => handleInputChange('surface', e.target.value)}
          className={inputClasses}
          placeholder="Surface"
        />
      </div>
      <div className="col-span-2">
        <input
          type="text"
          value={token.reading}
          onChange={(e) => handleInputChange('reading', e.target.value)}
          className={inputClasses}
          placeholder="Reading"
        />
      </div>
      <div className="col-span-3 relative">
        <input
          type="number"
          step="0.01"
          value={startTimeStr}
          onChange={(e) => setStartTimeStr(e.target.value)}
          onBlur={() => handleTimeBlur('startTime', startTimeStr)}
          className={timeInputClasses}
        />
      </div>
      <div className="col-span-3 relative">
        <input
          type="number"
          step="0.01"
          value={endTimeStr}
          onChange={(e) => setEndTimeStr(e.target.value)}
          onBlur={() => handleTimeBlur('endTime', endTimeStr)}
          className={timeInputClasses}
        />
      </div>
    </div>
  );
};

export default EditableWordRow;
