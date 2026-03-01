// src/components/tutor/ToolPanel.tsx
import React, { useState, useEffect } from 'react';
import useSongStore from '@/stores/useSongStore';
import useUIPanelStore from '@/stores/useUIPanelStore';
import { editorStoreActions } from '@/stores/useEditorStore';
import useMobileViewStore from '@/stores/useMobileViewStore';
import useTranslation from '@/hooks/useTranslation';
import { useRouter } from 'next/router';
import useVocabularyStore from '@/stores/useVocabularyStore';
import { db, blobToBase64 } from '@/lib/db';
import cn from 'classnames';
import { saveAs } from 'file-saver';

const ToolButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'default' | 'accent' | 'danger' | 'warning' | 'success';
}> = ({ onClick, disabled, label, icon, variant = 'default' }) => {
  const baseClasses = "w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center gap-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border active:scale-[0.98] group overflow-hidden";
  
  const variants = {
    primary: "bg-blue-600/20 border-blue-500/30 text-blue-100 hover:bg-blue-600/30 hover:border-blue-500/50",
    default: "bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 hover:border-gray-600",
    accent: "bg-purple-600/20 border-purple-500/30 text-purple-100 hover:bg-purple-600/30 hover:border-purple-500/50",
    danger: "bg-red-900/20 border-red-800/30 text-red-200 hover:bg-red-900/40 hover:border-red-700/50",
    warning: "bg-orange-600/20 border-orange-500/30 text-orange-100 hover:bg-orange-600/30 hover:border-orange-500/50",
    success: "bg-green-600/20 border-green-500/30 text-green-100 hover:bg-green-600/30 hover:border-green-500/50"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={cn(baseClasses, variants[variant])}>
      {icon && (
        <div className="w-5 h-5 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {React.cloneElement(icon as React.ReactElement<any>, { className: "w-full h-full" })}
        </div>
      )}
      <span className="flex-grow truncate text-sm sm:text-base">{label}</span>
      <svg className="w-4 h-4 opacity-20 flex-shrink-0 group-hover:opacity-40 transition-opacity group-hover:translate-x-0.5 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-6 px-1">{title}</h4>
);

const ToolPanel: React.FC = () => {
  const { song, cacheCurrentSongAudio, uncacheCurrentSongAudio, generateTranscriptionPreview, deleteSongs } = useSongStore();
  const { setActivePanel } = useUIPanelStore();
  const { setActiveView } = useMobileViewStore();
  const { t } = useTranslation();
  const { startReview } = useVocabularyStore();
  const router = useRouter();

  const [communityStatus, setCommunityStatus] = useState<'not-shared' | 'shared-by-me' | 'loading'>('loading');
  const [backendUrl, setBackendUrl] = useState('');
  const [myNickname, setMyNickname] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
      const loadSettings = async () => {
          const settings = await db.settings.get(0);
          setBackendUrl(settings?.backendUrl || 'http://localhost:8000');
          setMyNickname(settings?.sharerNickname || '');
      };
      loadSettings();
  }, []);

  useEffect(() => {
      const checkCommunityStatus = async () => {
          if (!song || !backendUrl || !myNickname) {
              setCommunityStatus('not-shared');
              return;
          }
          setCommunityStatus('loading');
          try {
              // We search by title and artist to see if we uploaded it
              const url = new URL(`${backendUrl}/api/community/songs`);
              url.searchParams.append('q', song.title);
              url.searchParams.append('sharer', myNickname);
              
              const res = await fetch(url.toString());
              if (!res.ok) throw new Error('Failed');
              const data = await res.json();
              
              // Verify it's the exact same local song by comparing sourceUrl or just assuming match
              const match = data.songs.find((s: any) => s.title === song.title);
              if (match) {
                  setCommunityStatus('shared-by-me');
              } else {
                  setCommunityStatus('not-shared');
              }
          } catch (e) {
              setCommunityStatus('not-shared');
          }
      };
      checkCommunityStatus();
  }, [song, backendUrl, myNickname]);

  const handleReview = async () => {
    if (!song || !song.id) return;
    const words = await db.words.where('sourceSongId').equals(song.id).toArray();
    if (words.length > 0) {
        startReview(words);
        router.push(`/vocabulary?returnToPlayer=${song.id}`);
    } else {
        alert(t('reviewSetup.noWordsToReviewAlert'));
    }
  };

  const handleEnterTimeSyncMode = () => {
    editorStoreActions.setTimeSyncMode(true);
    setActiveView('lyrics');
  };

  const handleExportLocal = async () => {
      if (!song || !song.id) return;
      try {
        const fullSong = await db.songs.get(song.id);
        if (!fullSong) throw new Error("Song not found in DB.");

        const wordsToShare = await db.words.where('sourceSongId').equals(song.id).toArray();
        const { audioData, ...rest } = fullSong;
        let coverImageBase64 = '';
        if (fullSong.coverImageData) {
            coverImageBase64 = await blobToBase64(fullSong.coverImageData);
        }
        const songPayload = { ...rest, coverImageData: coverImageBase64 };

        const exportData = {
            songs: [songPayload],
            words: wordsToShare
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        saveAs(blob, `j-melo-${song.title}.json`);
      } catch (e) {
          alert('Export failed: ' + (e as Error).message);
      }
  };

  const handleDeleteLocal = async () => {
      if (!song || !song.id) return;
      if (window.confirm(t('home.deleteConfirm', { count: 1 }))) {
          await deleteSongs([song.id]);
          router.push('/');
      }
  };

  const shareToCommunity = async () => {
      if (!song || !song.id) return;
      if (!myNickname) {
          alert(t('home.sharerNicknameRequiredAlert'));
          router.push('/settings');
          return;
      }
      setIsProcessing(true);
      try {
        const fullSong = await db.songs.get(song.id);
        if (!fullSong) throw new Error("Song not found in DB.");

        const wordsToShare = await db.words.where('sourceSongId').equals(song.id).toArray();
        const { audioData, ...rest } = fullSong;
        let coverImageBase64 = '';
        if (fullSong.coverImageData) {
            coverImageBase64 = await blobToBase64(fullSong.coverImageData);
        }
        const songPayload = { ...rest, coverImageData: coverImageBase64 };

        const payload = {
            title: song.title,
            artist: song.artist,
            cover_url: song.cover_url,
            sharer_name: myNickname,
            song_data: songPayload,
            words_data: wordsToShare
        };

        const response = await fetch(`${backendUrl}/api/community/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(await response.text());
        setCommunityStatus('shared-by-me');
      } catch (e) {
        alert("Failed to share: " + (e as Error).message);
      } finally {
          setIsProcessing(false);
      }
  };

  const deleteFromCommunity = async () => {
      if (!song || !myNickname) return;
      if (!window.confirm("Are you sure you want to delete this song from the community server?")) return;
      setIsProcessing(true);
      try {
          const url = new URL(`${backendUrl}/api/community/songs`);
          url.searchParams.append('q', song.title);
          url.searchParams.append('sharer', myNickname);
          const res = await fetch(url.toString());
          const data = await res.json();
          const match = data.songs.find((s: any) => s.title === song.title);
          if (!match) throw new Error("Could not find song on community server.");

          const delRes = await fetch(`${backendUrl}/api/community/songs/${match.id}?sharer_name=${encodeURIComponent(myNickname)}`, {
              method: 'DELETE'
          });
          if (!delRes.ok) throw new Error("Failed to delete from community server.");
          setCommunityStatus('not-shared');
      } catch (e) {
          alert("Delete failed: " + (e as Error).message);
      } finally {
          setIsProcessing(false);
      }
  };

  const InfoRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
    <div className="flex justify-between text-sm mb-2 bg-gray-700/30 p-2 rounded">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-mono truncate ml-4 max-w-[60%] text-right" title={value || 'N/A'}>{value || t('common.na')}</span>
    </div>
  );

  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col text-white">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
        <h2 className="text-xl font-bold">{t('toolPanel.title')}</h2>
        <button 
          onClick={() => setActivePanel('SONG_INFO_EDITOR')}
          className="px-3 py-1.5 bg-gray-700 text-sm font-medium rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          disabled={!song}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          {t('toolPanel.editInfoButton')}
        </button>
      </div>
      
      <div className="flex-grow overflow-y-auto pr-2 pb-8 custom-scrollbar">
        <div className="mb-6">
          {song ? (
            <div className="space-y-1">
              <InfoRow label={t('toolPanel.titleLabel')} value={song.title} />
              <InfoRow label={t('toolPanel.artistLabel')} value={song.artist} />
              <InfoRow label={t('toolPanel.durationLabel')} value={`${song.duration.toFixed(2)}s`} />
            </div>
          ) : (
            <div className="bg-gray-700/50 p-6 rounded-lg text-center text-gray-400 border border-gray-600 border-dashed">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                {t('toolPanel.noSongLoaded')}
            </div>
          )}
        </div>
  
        <div className="space-y-3">
          
          <SectionHeader title={t('toolPanel.sectionLearning') || 'Learning'} />
          <ToolButton 
              onClick={handleReview}
              disabled={!song}
              variant="primary"
              label={t('home.reviewButton')}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
          />

          <SectionHeader title={t('toolPanel.sectionDataSources') || 'Data Sources'} />
          <ToolButton 
              onClick={() => setActivePanel('TIMELESS_LYRICS_IMPORTER')}
              disabled={!song}
              label={t('lyricsDisplay.noLyrics.importButton')}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
          />
          <ToolButton 
              onClick={() => song && generateTranscriptionPreview(song, t)}
              disabled={!song}
              label={t('toolPanel.retranscribeButton')}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
          />

          <SectionHeader title={t('toolPanel.sectionEditing') || 'Editing & Synchronization'} />
          <ToolButton 
              onClick={handleEnterTimeSyncMode}
              disabled={!song}
              variant="accent"
              label={t('toolPanel.timeSyncModeButton') || 'Time Sync Mode'}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <ToolButton 
              onClick={() => setActivePanel('AI_CORRECTOR')}
              disabled={!song}
              label={t('toolPanel.aiLyricCorrectionButton')}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
          />
          <ToolButton 
              onClick={() => setActivePanel('LYRIC_TRANSLATION_PANEL')}
              disabled={!song}
              label={t('toolPanel.lyricTranslationButton')}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>}
          />
          <ToolButton 
              onClick={() => setActivePanel('FULL_LYRICS_EDITOR')}
              disabled={!song}
              label={t('toolPanel.editFullLyricsButton')}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
          />

          <SectionHeader title={t('toolPanel.sectionCommunity')} />
          {communityStatus === 'not-shared' && (
             <ToolButton 
                 onClick={shareToCommunity}
                 disabled={!song || isProcessing}
                 variant="success"
                 label={isProcessing ? t('toolPanel.uploading') : t('toolPanel.shareToCommunity')}
                 icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
             />
          )}
          {communityStatus === 'shared-by-me' && (
             <>
                 <ToolButton 
                     onClick={shareToCommunity}
                     disabled={!song || isProcessing}
                     variant="warning"
                     label={isProcessing ? t('toolPanel.updating') : t('toolPanel.updateCommunityData')}
                     icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                 />
                 <ToolButton 
                     onClick={deleteFromCommunity}
                     disabled={!song || isProcessing}
                     variant="danger"
                     label={isProcessing ? t('toolPanel.deleting') : t('toolPanel.deleteFromCommunity')}
                     icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                 />
             </>
          )}

          <SectionHeader title={t('toolPanel.sectionSystem')} />
          <ToolButton 
              onClick={handleExportLocal}
              disabled={!song}
              label={t('toolPanel.exportSongData')}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
          />
          <ToolButton 
              onClick={song?.is_cached ? uncacheCurrentSongAudio : cacheCurrentSongAudio}
              disabled={!song}
              variant={song?.is_cached ? 'default' : 'primary'}
              label={song?.is_cached ? t('toolPanel.uncacheAudioButton') : t('toolPanel.cacheAudioButton')}
              icon={song?.is_cached ? 
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> : 
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              }
          />
          <ToolButton 
              onClick={handleDeleteLocal}
              disabled={!song}
              variant="danger"
              label={t('toolPanel.deleteFromLocal')}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
          />
        </div>
      </div>
    </div>
  );
};

export default ToolPanel;