// src/pages/index.tsx
import Head from 'next/head';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Player from '@/components/player/Player';
import LyricsDisplay from '@/components/lyrics/LyricsDisplay';
import AIPanel from '@/components/tutor/AIPanel';
import SentenceEditor from '@/components/editor/SentenceEditor';
import FullLyricsEditor from '@/components/editor/FullLyricsEditor';
import ToolPanel from '@/components/tutor/ToolPanel';
import useSongStore, { songStoreActions } from '@/stores/useSongStore';
import usePlayerStore from '@/stores/usePlayerStore';
import useLyricsProcessor from '@/hooks/useLyricsProcessor';
import useTutorStore from '@/stores/useTutorStore';
import useEditorStore, { editorStoreActions } from '@/stores/useEditorStore';
import useUIPanelStore from '@/stores/useUIPanelStore';
import { mockLyrics } from '@/lib/mock-data';
import { LyricLine } from '@/interfaces/lyrics';

const SongInput: React.FC = () => {
  const [url, setUrl] = useState('');
  const { song, isLoading, error } = useSongStore();

  const handleFetch = () => {
    if (url) songStoreActions.fetchSong(url);
  };

  const handleShare = () => {
    if (song) {
      const shareUrl = `${window.location.origin}?url=${encodeURIComponent(song.sourceUrl)}`;
      navigator.clipboard.writeText(shareUrl).then(() => alert('Share link copied!'));
    }
  };

  return (
    <div className="p-4 bg-gray-800">
      <h2 className="text-white text-lg mb-2">Load a song from URL</h2>
      <div className="flex space-x-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter song URL"
          className="flex-grow p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={isLoading}
        />
        <button
          onClick={handleFetch}
          className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-bold disabled:bg-gray-500"
          disabled={isLoading}
        >
          Load
        </button>
        <button
          onClick={handleShare}
          className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-500 text-white font-bold disabled:bg-gray-500"
          disabled={!song}
        >
          Share
        </button>
      </div>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
};

const RightHandPanel = () => {
  const { song } = useSongStore();
  const editingLine = useEditorStore((state) => state.editingLine);
  const { activePanel } = useUIPanelStore();

  // The logic is now simpler and based on a clear priority
  // which is managed by the actions themselves.
  if (activePanel === 'SENTENCE_EDITOR' && editingLine && song?.media_url) {
    const handleSaveSentenceEdit = (updatedLine: LyricLine) => {
      songStoreActions.updateLyricLine(updatedLine);
      editorStoreActions.clearEditingLine();
      useUIPanelStore.getState().setActivePanel('TOOL_PANEL');
    };
    const handleCancelSentenceEdit = () => {
      editorStoreActions.clearEditingLine();
      useUIPanelStore.getState().setActivePanel('TOOL_PANEL');
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

  if (activePanel === 'AI_TUTOR') return <AIPanel />;
  if (activePanel === 'AI_CORRECTOR') return <AILyricCorrector />;
  if (activePanel === 'FULL_LYRICS_EDITOR') return <FullLyricsEditor />;

  // Default fallback
  return <ToolPanel />;
};


const IndexPage = () => {
  const { song, lyrics, previewLyrics, whisperData, isLoading } = useSongStore();
  const currentTime = usePlayerStore((state) => state.currentTime);
  
  useLyricsProcessor({
    whisperData,
    onProcessed: songStoreActions.setProcessedLyrics,
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const url = urlParams.get('url');
    if (url) {
      songStoreActions.fetchSong(url);
    }
  }, []);

  const displayLyrics = previewLyrics || lyrics || (isLoading ? [] : mockLyrics);

  return (
    <>
      <Head>
        <title>J-Melo</title>
      </Head>
      <main className="bg-gray-900 h-screen flex flex-col">
        <div className="p-2 bg-gray-800 flex justify-between items-center">
          <h1 className="text-white text-lg font-bold">J-Melo</h1>
          <div className="space-x-4">
            <Link href="/vocabulary" className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 text-white">
              Vocab
            </Link>
            <Link href="/settings" className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-white">
              Settings
            </Link>
          </div>
        </div>
        <div className="flex-grow lg:grid lg:grid-cols-3 lg:gap-2 overflow-hidden">
          <div className="lg:col-span-1 h-full flex flex-col overflow-y-auto">
            <SongInput />
            <Player song={song} />
          </div>
          <div className="lg:col-span-1 h-full overflow-y-auto">
            {isLoading ? 
              <div className="text-white p-4">Loading lyrics...</div> : 
              <LyricsDisplay lyrics={displayLyrics} currentTime={currentTime} />
            }
          </div>
          <div className="lg:col-span-1 h-full overflow-hidden">
            <RightHandPanel />
          </div>
        </div>
      </main>
    </>
  );
};

export default IndexPage;