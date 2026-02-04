// src/components/tutor/ToolPanel.tsx
import React from 'react';
import useSongStore from '@/stores/useSongStore';
import useUIPanelStore from '@/stores/useUIPanelStore';

const ToolPanel: React.FC = () => {
  const song = useSongStore((state) => state.song);
  const { setActivePanel } = useUIPanelStore();

  const InfoRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
    <div className="flex justify-between text-sm mb-2">
      <span className="text-gray-400">{label}:</span>
      <span className="text-white font-mono truncate ml-2" title={value || 'N/A'}>{value || 'N/A'}</span>
    </div>
  );

  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col text-white">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Tools & Info</h2>
        <button 
          onClick={() => setActivePanel('SONG_INFO_EDITOR')}
          className="px-3 py-1 bg-gray-600 text-xs rounded-lg hover:bg-gray-500 disabled:opacity-50"
          disabled={!song}
        >
          Edit Info
        </button>
      </div>
      
      <div className="flex-grow overflow-y-auto">
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
  
        <div>
          <h3 className="text-lg font-semibold border-b border-gray-700 pb-2 mb-3">Tools</h3>
          <div className="space-y-2">
             <button 
              className="w-full text-left p-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
              onClick={() => setActivePanel('AI_CORRECTOR')}
            >
              AI Lyric Correction
            </button>
            <button 
              className="w-full text-left p-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
              onClick={() => setActivePanel('FULL_LYRICS_EDITOR')}
            >
              Edit Full Lyrics (JSON)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolPanel;