// src/pages/index.tsx
import Head from 'next/head';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSwipeable } from 'react-swipeable';
import cn from 'classnames';

import Player from '@/components/player/Player';
import LyricsDisplay from '@/components/lyrics/LyricsDisplay';
import AIPanel from '@/components/tutor/AIPanel';
import SentenceEditor from '@/components/editor/SentenceEditor';
import FullLyricsEditor from '@/components/editor/FullLyricsEditor';
import ToolPanel from '@/components/tutor/ToolPanel';
import SongInfoEditor from '@/components/editor/SongInfoEditor';
import AILyricCorrector from '@/components/tutor/AILyricCorrector'; // Add this import
import LyricTranslationPanel from '@/components/tutor/LyricTranslationPanel'; // Import LyricTranslationPanel
import useSongStore from '@/stores/useSongStore';
import usePlayerStore from '@/stores/usePlayerStore';
import useLyricsProcessor from '@/hooks/useLyricsProcessor';
import useEditorStore, { editorStoreActions } from '@/stores/useEditorStore';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useMobileViewStore from '@/stores/useMobileViewStore';
import useTranslation from '@/hooks/useTranslation'; // Import useTranslation
import { LyricLine } from '@/interfaces/lyrics';
import { mockLyrics } from '@/lib/mock-data';

const SongInput: React.FC = () => {
  const [url, setUrl] = useState('');
  const { song, isLoading, error, fetchSong } = useSongStore();
  const { t } = useTranslation();

  const handleFetch = () => {
    if (url) fetchSong(url);
  };

  const handleShare = () => {
    if (song) {
      const shareUrl = `${window.location.origin}?url=${encodeURIComponent(song.sourceUrl)}`;
      navigator.clipboard.writeText(shareUrl).then(() => alert(t('index.shareLinkCopied')));
    }
  };

  return (
    <div className="p-4 bg-gray-800">
      <h2 className="text-white text-lg mb-2">{t('index.loadSongFromUrl')}</h2>
      <div className="flex space-x-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('index.enterSongUrl')}
          className="flex-grow p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={isLoading}
        />
        <button
          onClick={handleFetch}
          className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-bold disabled:bg-gray-500"
          disabled={isLoading}
        >
          {t('index.loadButton')}
        </button>
        <button
          onClick={handleShare}
          className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-500 text-white font-bold disabled:bg-gray-500"
          disabled={!song}
        >
          {t('index.shareButton')}
        </button>
      </div>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
};

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
  if (activePanel === 'LYRIC_TRANSLATION_PANEL') return <LyricTranslationPanel />; // Add this line

  return <ToolPanel />;
};

const MobileNavDots = () => {
    const { activeView, setActiveView } = useMobileViewStore();
    const views = ['player', 'lyrics', 'tools'];
    return (
      <div className="lg:hidden flex justify-center items-center p-2 space-x-2">
        {views.map(view => (
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

const IndexPage = () => {
  const { song, lyrics, previewLyrics, whisperData, isLoading, fetchSong, setProcessedLyrics } = useSongStore();
  const currentTime = usePlayerStore((state) => state.currentTime);
  const { activeView, goToNextView, goToPrevView } = useMobileViewStore();
  const { t } = useTranslation();

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => goToNextView(),
    onSwipedRight: () => goToPrevView(),
    preventScrollOnSwipe: true,
    trackMouse: true,
  });
  
  useLyricsProcessor({
    whisperData,
    onProcessed: setProcessedLyrics,
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const url = urlParams.get('url');
    if (url) {
      fetchSong(url);
    }
  }, [fetchSong]);

  const displayLyrics = previewLyrics || lyrics || (isLoading ? [] : mockLyrics);

  return (
    <>
      <Head>
        <title>J-Melo</title>
      </Head>
      <main className="bg-gray-900 h-screen flex flex-col">
        <div className="p-2 bg-gray-800 flex justify-between items-center">
          <h1 className="text-white text-lg font-bold">J-Melo</h1>
          <div className="flex gap-2">
            <Link href="/vocabulary" className="px-3 py-1 text-sm bg-blue-600 rounded-lg hover:bg-blue-500 text-white">
              {t('index.vocabularyButton')}
            </Link>
            <Link href="/settings" className="px-3 py-1 text-sm bg-gray-600 rounded-lg hover:bg-gray-500 text-white">
              {t('index.settingsButton')}
            </Link>
          </div>
        </div>

        <div {...swipeHandlers} className="flex-grow flex flex-col lg:grid lg:grid-cols-3 lg:gap-2 overflow-hidden">
          
          <div className={cn("h-full flex-col overflow-y-auto", { 'flex': activeView === 'player', 'hidden lg:flex': activeView !== 'player' })}>
            <SongInput />
            <Player song={song} />
          </div>

          <div className={cn("h-full overflow-y-auto", { 'block': activeView === 'lyrics', 'hidden lg:block': activeView !== 'lyrics' })}>
            {isLoading ? 
              <div className="text-white p-4">{t('index.loadingLyrics')}</div> : 
              <LyricsDisplay lyrics={displayLyrics} currentTime={currentTime} />
            }
          </div>

          <div className={cn("h-full overflow-y-auto", { 'block': activeView === 'tools', 'hidden lg:block': activeView !== 'tools' })}>
            <RightHandPanel />
          </div>

        </div>

        <MobileNavDots />
      </main>
    </>
  );
};

export default IndexPage;
