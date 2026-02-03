// src/components/tutor/ToolPanel.tsx
import React from 'react';
import useSongStore from '@/stores/useSongStore';
import useUIPanelStore from '@/stores/useUIPanelStore'; // Import useUIPanelStore

const ToolPanel: React.FC = () => {
  const song = useSongStore((state) => state.song);
  const { setActivePanel } = useUIPanelStore(); // Access setActivePanel

  // A simple component to render a piece of song information.
  const InfoRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
    <div className="flex justify-between text-sm mb-2">
      <span className="text-gray-400">{label}:</span>
      <span className="text-white font-mono truncate ml-2" title={value || 'N/A'}>{value || 'N/A'}</span>
    </div>
  );

  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col text-white">
      <h2 className="text-xl font-bold mb-4">Tools & Info</h2>
      <div className="flex-grow overflow-y-auto">
        {/* Song Information Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold border-b border-gray-700 pb-2 mb-3">Song Information</h3>
          {song ? (
            <>
              <InfoRow label="Title" value={song.title} />
              <InfoRow label="Artist" value={song.artist} />
              <InfoRow label="Source" value={song.sourceUrl} />
              <InfoRow label="Duration" value={`${song.duration.toFixed(2)}s`} />
            </>
          ) : (
            <p className="text-gray-500 text-sm">No song loaded.</p>
          )}
        </div>
  
        {/* Tools Section */}
        <div>
          <h3 className="text-lg font-semibold border-b border-gray-700 pb-2 mb-3">Tools</h3>
          <div className="space-y-2">
             <button 
              className="w-full text-left p-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
              onClick={() => setActivePanel('AI_CORRECTOR')} // Add onClick handler
            >
              AI Lyric Correction
            </button>
            <button 
              className="w-full text-left p-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
              onClick={() => setActivePanel('FULL_LYRICS_EDITOR')}
            >
              Edit Full Lyrics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolPanel;
