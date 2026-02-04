// src/components/tutor/ToolPanel.tsx
import React from 'react';
import useSongStore from '@/stores/useSongStore';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useTranslation from '@/hooks/useTranslation'; // Import useTranslation

const ToolPanel: React.FC = () => {
  const { song, cacheCurrentSongAudio } = useSongStore();
  const { setActivePanel } = useUIPanelStore();
  const { t } = useTranslation(); // Initialize useTranslation

  const InfoRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
    <div className="flex justify-between text-sm mb-2">
      <span className="text-gray-400">{label}:</span>
      <span className="text-white font-mono truncate ml-2" title={value || 'N/A'}>{value || t('common.na')}</span>
    </div>
  );

  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col text-white">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{t('toolPanel.title')}</h2>
        <button 
          onClick={() => setActivePanel('SONG_INFO_EDITOR')}
          className="px-3 py-1 bg-gray-600 text-xs rounded-lg hover:bg-gray-500 disabled:opacity-50"
          disabled={!song}
        >
          {t('toolPanel.editInfoButton')}
        </button>
      </div>
      
      <div className="flex-grow overflow-y-auto">
        <div className="mb-6">
          <h3 className="text-lg font-semibold border-b border-gray-700 pb-2 mb-3">{t('toolPanel.songInformation')}</h3>
          {song ? (
            <>
              <InfoRow label={t('toolPanel.titleLabel')} value={song.title} />
              <InfoRow label={t('toolPanel.artistLabel')} value={song.artist} />
              <InfoRow label={t('toolPanel.sourceLabel')} value={song.sourceUrl} />
              <InfoRow label={t('toolPanel.durationLabel')} value={`${song.duration.toFixed(2)}s`} />
            </>
          ) : (
            <p className="text-gray-500 text-sm">{t('toolPanel.noSongLoaded')}</p>
          )}
        </div>
  
        <div>
          <h3 className="text-lg font-semibold border-b border-gray-700 pb-2 mb-3">{t('toolPanel.toolsSectionTitle')}</h3>
          <div className="space-y-2">
            <button 
              onClick={cacheCurrentSongAudio}
              disabled={!song || song.is_cached}
              className="w-full text-left p-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {song?.is_cached ? t('toolPanel.audioCached') : t('toolPanel.cacheAudioButton')}
            </button>
            <button 
              className="w-full text-left p-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
              onClick={() => setActivePanel('AI_CORRECTOR')}
            >
              {t('toolPanel.aiLyricCorrectionButton')}
            </button>
            <button 
              className="w-full text-left p-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
              onClick={() => setActivePanel('FULL_LYRICS_EDITOR')}
            >
              {t('toolPanel.editFullLyricsButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolPanel;