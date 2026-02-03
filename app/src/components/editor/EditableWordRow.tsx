// app/src/components/editor/EditableWordRow.tsx
import React from 'react';
import { LyricToken } from '@/interfaces/lyrics';

interface EditableWordRowProps {
  token: LyricToken;
  index: number;
  onTokenChange: (index: number, field: keyof LyricToken, value: any) => void;
}

const EditableWordRow: React.FC<EditableWordRowProps> = ({ token, index, onTokenChange }) => {
  const handleInputChange = (field: keyof LyricToken, value: string) => {
    const isTimeField = field === 'startTime' || field === 'endTime';
    onTokenChange(index, field, isTimeField ? parseFloat(value) || 0 : value);
  };

  return (
    <div className="grid grid-cols-5 gap-2 items-center p-2 rounded-lg bg-gray-700">
      <div className="text-white font-bold">{index + 1}</div>
      <input
        type="text"
        value={token.surface}
        onChange={(e) => handleInputChange('surface', e.target.value)}
        className="w-full bg-gray-600 text-white p-1 rounded border border-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <input
        type="text"
        value={token.reading}
        onChange={(e) => handleInputChange('reading', e.target.value)}
        className="w-full bg-gray-600 text-white p-1 rounded border border-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <input
        type="number"
        step="0.01"
        value={token.startTime.toFixed(2)}
        onChange={(e) => handleInputChange('startTime', e.target.value)}
        className="w-full bg-gray-600 text-white p-1 rounded border border-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <input
        type="number"
        step="0.01"
        value={token.endTime.toFixed(2)}
        onChange={(e) => handleInputChange('endTime', e.target.value)}
        className="w-full bg-gray-600 text-white p-1 rounded border border-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
      />
    </div>
  );
};

export default EditableWordRow;
