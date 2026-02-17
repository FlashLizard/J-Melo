// app/src/pages/player/[songId].tsx
import Head from 'next/head';
import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSwipeable } from 'react-swipeable';
import cn from 'classnames';

import Player from '@/components/player/Player';
import LyricsDisplay from '@/components/lyrics/LyricsDisplay';
import AIPanel from '@/components/tutor/AIPanel';
import SentenceEditor from '@/components/editor/SentenceEditor';
import FullLyricsEditor from '@/components/editor/FullLyricsEditor';
import ToolPanel from '@/components/tutor/ToolPanel';
import SongInfoEditor from '@/components/editor/SongInfoEditor';
import AILyricCorrector from '@/components/tutor/AILyricCorrector';
import LyricTranslationPanel from '@/components/tutor/LyricTranslationPanel';
import useSongStore from '@/stores/useSongStore';
import usePlayerStore from '@/stores/usePlayerStore';
import useLyricsProcessor from '@/hooks/useLyricsProcessor';
import useEditorStore, { editorStoreActions } from '@/stores/useEditorStore';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useMobileViewStore, { MOBILE_VIEWS } from '@/stores/useMobileViewStore';
import useTranslation from '@/hooks/useTranslation';
import { LyricLine } from '@/interfaces/lyrics';

const RightHandPanel = () => {
  const { song, updateLyricLine } = useSongStore();
  const editingLine = useEditorStore((state) => state.editingLine);
  const { activePanel, setActivePanel } = useUIPanelStore();

  if (activePanel === 'AI_TUTOR') return <AIPanel />;
  
  if (activePanel === 'SENTENCE_EDITOR' && editingLine && song?.media_url) {
    const handleSaveSentenceEdit = (updatedLine: LyricLine) => {
      updateLyricLine(updatedLine);
      editorStoreActions.clearEditingLine();
      setActivePanel('TOOL_PANEL');
    };
    const handleCancelSentenceEdit = () => {
      editorStoreActions.clearEditingLine();
      setActivePanel('TOOL_PANEL');
    };
    return (
      <SentenceEditor
        line={editingLine}
        onSave={handleSaveSentenceEdit}
        onCancel={handleCancelSentenceEdit}
        relativeAudioUrl={song.media_url}
      />
    );
  }

  if (activePanel === 'AI_CORRECTOR') return <AILyricCorrector />;
  if (activePanel === 'FULL_LYRICS_EDITOR') return <FullLyricsEditor />;
  if (activePanel === 'SONG_INFO_EDITOR') return <SongInfoEditor />;
  if (activePanel === 'LYRIC_TRANSLATION_PANEL') return <LyricTranslationPanel />;

  return <ToolPanel />;
};

const MobileNavDots = () => {
    const { activeView, setActiveView } = useMobileViewStore();
    return (
      <div className="lg:hidden flex justify-center items-center p-2 space-x-2 z-30">
        {MOBILE_VIEWS.map(view => (
          <button
            key={view}
            onClick={() => setActiveView(view as any)}
            className={cn("w-2 h-2 rounded-full transition-colors", {
              "bg-green-500": activeView === view,
              "bg-gray-600": activeView !== view,
            })}
          />
        ))}
      </div>
    );
};

const PlayerPage = () => {
  const { song, lyrics, previewLyrics, whisperData, isLoading, fetchSong, setProcessedLyrics, loadSongById } = useSongStore();
  const currentTime = usePlayerStore((state) => state.currentTime);
  const { activeView, dragOffset, setDragOffset, goToNextView, goToPrevView } = useMobileViewStore();
  const { t } = useTranslation();
  const router = useRouter();
  const { songId } = router.query;

  const [isMobile, setIsMobile] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const currentIndex = useMemo(() => MOBILE_VIEWS.indexOf(activeView), [activeView]);

  const swipeHandlers = useSwipeable({
    onSwiping: (e) => {
      if (!isMobile) return;
      const startX = e.initial[0];
      const edgeWidth = window.innerWidth * 0.15; // 15% edge zone
      if (startX > edgeWidth && startX < window.innerWidth - edgeWidth) return;

      setIsSwiping(true);
      // Limit dragging past boundaries with resistance
      if ((currentIndex === 0 && e.deltaX > 0) || (currentIndex === MOBILE_VIEWS.length - 1 && e.deltaX < 0)) {
        setDragOffset(e.deltaX * 0.2);
      } else {
        setDragOffset(e.deltaX);
      }
    },
    onSwiped: (e) => {
      if (!isMobile) return;
      setIsSwiping(false);
      const startX = e.initial[0];
      const edgeWidth = window.innerWidth * 0.15;
      if (startX > edgeWidth && startX < window.innerWidth - edgeWidth) {
        setDragOffset(0);
        return;
      }

      const threshold = window.innerWidth * 0.3; // 30% width to trigger switch
      if (e.deltaX < -threshold && currentIndex < MOBILE_VIEWS.length - 1) {
        goToNextView();
      } else if (e.deltaX > threshold && currentIndex > 0) {
        goToPrevView();
      } else {
        setDragOffset(0);
      }
    },
    delta: 20, // Minimum distance before swiping starts
    trackMouse: true,
    preventScrollOnSwipe: true,
  });
  
  useLyricsProcessor({
    whisperData,
    onProcessed: setProcessedLyrics,
  });

  useEffect(() => {
    if (songId && typeof songId === 'string') {
      const currentSongId = parseInt(songId);
      loadSongById(currentSongId);
    }
  }, [songId, loadSongById]);

  // Existing logic for URL params to load song from external URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const url = urlParams.get('url');
    if (url && !songId && !song) {
      fetchSong(url);
    }
  }, [fetchSong, song, songId]);

  const displayLyrics = previewLyrics || lyrics || [];

  return (
    <>
      <Head>
        <title>{`J-Melo Player${song ? ` - ${song.title}` : ''}`}</title>
      </Head>
      <main className="bg-gray-900 h-screen flex flex-col overflow-hidden">
        <div className="p-2 bg-gray-800 flex justify-between items-center z-30">
          <h1 className="text-white text-lg font-bold">J-Melo Player</h1>
          <div className="flex gap-2">
            <Link href="/" className="px-3 py-1 text-sm bg-gray-600 rounded-lg hover:bg-gray-500 text-white">
              &larr; {t('player.backToHome')}
            </Link>
            <Link href="/vocabulary" className="px-3 py-1 text-sm bg-blue-600 rounded-lg hover:bg-blue-500 text-white">
              {t('index.vocabularyButton')}
            </Link>
            <Link href="/settings" className="px-3 py-1 text-sm bg-gray-600 rounded-lg hover:bg-gray-500 text-white">
              {t('index.settingsButton')}
            </Link>
          </div>
        </div>

        <div {...swipeHandlers} className="flex-grow relative overflow-hidden">
          <div 
            className={cn("h-full flex lg:grid lg:grid-cols-3 lg:gap-2 lg:!transform-none", {
                "transition-transform duration-300 ease-out": !isSwiping
            })}
            style={isMobile ? {
                width: '300%',
                transform: `translateX(calc(${-currentIndex * 33.3333}% + ${dragOffset}px))`
            } : {}}
          >
            {/* View 1: Player */}
            <div className="w-1/3 lg:w-full h-full flex flex-col overflow-y-auto">
              <Player song={song} />
            </div>

            {/* View 2: Lyrics */}
            <div className="w-1/3 lg:w-full h-full overflow-y-auto border-x border-gray-800/50">
              {isLoading ? 
                <div className="text-white p-4">{t('index.loadingLyrics')}</div> : 
                <LyricsDisplay lyrics={displayLyrics} currentTime={currentTime} />
              }
            </div>

            {/* View 3: Tools */}
            <div className="w-1/3 lg:w-full h-full overflow-y-auto">
              <RightHandPanel />
            </div>
          </div>
        </div>

        <MobileNavDots />
      </main>
    </>
  );
};

export default PlayerPage;
