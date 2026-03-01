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
import usePlayerStore, { playerStoreActions } from '@/stores/usePlayerStore';
import useLyricsProcessor from '@/hooks/useLyricsProcessor';
import useEditorStore, { editorStoreActions } from '@/stores/useEditorStore';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useMobileViewStore, { MOBILE_VIEWS } from '@/stores/useMobileViewStore';
import useTranslation from '@/hooks/useTranslation';
import { LyricLine } from '@/interfaces/lyrics';

import TimelessLyricsImporter from '@/components/tutor/TimelessLyricsImporter';

const RightHandPanel = () => {
  const { song, updateLyricLine } = useSongStore();
  const editingLine = useEditorStore((state) => state.editingLine);
  const editingLineIndex = useEditorStore((state) => state.editingLineIndex);
  const { activePanel, setActivePanel } = useUIPanelStore();

  if (activePanel === 'AI_TUTOR') return <AIPanel />;
  
  if (activePanel === 'SENTENCE_EDITOR' && editingLine && editingLineIndex !== null && song?.media_url) {
    const handleSaveSentenceEdit = (index: number, updatedLine: LyricLine) => {
      updateLyricLine(index, updatedLine);
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
        lineIndex={editingLineIndex}
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
  if (activePanel === 'TIMELESS_LYRICS_IMPORTER') return <TimelessLyricsImporter />;

  return <ToolPanel />;
};

const MobileNavDots = () => {
    const { activeView, setActiveView, goToNextView, goToPrevView } = useMobileViewStore();
    const currentIndex = MOBILE_VIEWS.indexOf(activeView);
    
    return (
      <div className="lg:hidden flex justify-between items-center px-6 py-3 bg-gray-900/90 backdrop-blur-md border-t border-gray-800 z-30 flex-shrink-0">
        <button 
          onClick={goToPrevView}
          disabled={currentIndex === 0}
          className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-full hover:bg-gray-800"
          aria-label="Previous View"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
        </button>
        
        <div className="flex space-x-3">
          {MOBILE_VIEWS.map(view => (
            <button
              key={view}
              onClick={() => setActiveView(view as any)}
              className={cn("w-2.5 h-2.5 rounded-full transition-all duration-300", {
                "bg-green-500 scale-125": activeView === view,
                "bg-gray-600 hover:bg-gray-500": activeView !== view,
              })}
            />
          ))}
        </div>

        <button 
          onClick={goToNextView}
          disabled={currentIndex === MOBILE_VIEWS.length - 1}
          className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-full hover:bg-gray-800"
          aria-label="Next View"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    );
};

const PlayerPage = () => {
  const { song, lyrics, previewLyrics, whisperData, isLoading, fetchSong, setProcessedLyrics, loadSongById } = useSongStore();
  const currentTime = usePlayerStore((state) => state.currentTime);
  const { activeView, dragOffset, setDragOffset, goToNextView, goToPrevView, isSwipeDisabled, setActiveView } = useMobileViewStore();
  const { setActivePanel } = useUIPanelStore();
  const { t } = useTranslation();
  const router = useRouter();
  const { songId } = router.query;

  const [isMobile, setIsMobile] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);

  // Reset view on initial mount of the player page
  useEffect(() => {
      setActiveView('player');
      setActivePanel('TOOL_PANEL');
  }, [setActiveView, setActivePanel]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const currentIndex = useMemo(() => MOBILE_VIEWS.indexOf(activeView), [activeView]);

  const swipeHandlers = useSwipeable({
    onSwiping: (e) => {
      if (!isMobile || isSwipeDisabled) return;
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
      if (!isMobile || isSwipeDisabled) return;
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

  const { hasEnded, playMode } = usePlayerStore();

  useEffect(() => {
    if (hasEnded && song?.id) {
        const playNext = async () => {
            playerStoreActions.clearHasEnded();
            try {
                // We use Dexie directly to get the latest list
                const { db } = await import('@/lib/db');
                const allSongs = await db.songs.toArray();
                if (allSongs.length === 0) return;

                let nextSongId = song.id;

                if (playMode === 'sequential') {
                    const currentIndex = allSongs.findIndex(s => s.id === song.id);
                    if (currentIndex !== -1) {
                        const nextIndex = (currentIndex + 1) % allSongs.length;
                        nextSongId = allSongs[nextIndex].id!;
                    }
                } else if (playMode === 'shuffle') {
                    if (allSongs.length > 1) {
                        let randomIndex;
                        do {
                            randomIndex = Math.floor(Math.random() * allSongs.length);
                        } while (allSongs[randomIndex].id === song.id);
                        nextSongId = allSongs[randomIndex].id!;
                    }
                }
                // 'loop-single' just stays on the same song
                if (nextSongId) {
                    // Use a query parameter to instruct the next page load to auto-play
                    router.push(`/player/${nextSongId}?autoplay=1`);
                }
            } catch (error) {
                console.error("Auto-play next failed", error);
            }
        };
        playNext();
    }
  }, [hasEnded, song, playMode, router]);

  // Handle the autoplay query parameter
  useEffect(() => {
    // Only attempt autoplay if we have a song, it's not currently playing, and we have an audio element ready.
    // The actual play() might need to happen slightly after the audio element is mounted.
    if (router.isReady && router.query.autoplay === '1' && song && !isLoading) {
        // We set a small timeout to let the <audio> element register its 'canplay' or just mount.
        const playTimer = setTimeout(() => {
            playerStoreActions.play();
            // Clean up the URL so it doesn't auto-play again on accidental refresh
            router.replace(`/player/${song.id}`, undefined, { shallow: true });
        }, 500);
        return () => clearTimeout(playTimer);
    }
  }, [router.isReady, router.query.autoplay, song, isLoading, router]);

  const displayLyrics = previewLyrics || lyrics || [];

  return (
    <>
      <Head>
        <title>{`J-Melo Player${song ? ` - ${song.title}` : ''}`}</title>
      </Head>
      <main className="bg-[#0f172a] h-screen flex flex-col overflow-hidden selection:bg-indigo-500/30">
        <div className="p-3 sm:p-4 bg-gray-800/40 backdrop-blur-md border-b border-gray-700/50 flex justify-between items-center z-30 shadow-lg">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0">
            <div className="bg-gray-900/50 p-1.5 rounded-xl border border-gray-700/50 flex-shrink-0">
                <img src="/logo.svg" alt="J-Melo Logo" className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-md" />
            </div>
            <h1 className="text-white text-base sm:text-lg font-bold tracking-tight truncate">J-Melo Player</h1>
          </Link>
          <Link href="/" className="p-2 sm:p-2.5 bg-gray-700/80 text-gray-200 rounded-xl hover:bg-gray-600 hover:text-white transition-all flex items-center justify-center border border-gray-600/50 shadow-sm flex-shrink-0" title={t('player.backToHome')}>
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
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
