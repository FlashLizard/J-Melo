// src/pages/index.tsx
import Head from 'next/head';
import React, { useState, useEffect } from 'react';
import Player from '@/components/player/Player';
import LyricsDisplay from '@/components/lyrics/LyricsDisplay';
import AIPanel from '@/components/tutor/AIPanel';
import useSongStore from '@/stores/useSongStore';
import usePlayerStore from '@/stores/usePlayerStore';
import useLyricsProcessor from '@/hooks/useLyricsProcessor';
import { mockLyrics } from '@/lib/mock-data'; // Keep for fallback

const SongInput: React.FC = () => {
  const [url, setUrl] = useState('');
  const fetchSong = useSongStore((state) => state.actions.fetchSong);
  const { song, isLoading, error } = useSongStore();
  const { processLyrics, isLoading: isProcessing } = useLyricsProcessor();

  const handleFetch = () => {
    if (url) {
      fetchSong(url, processLyrics);
    }
  };

  const handleShare = () => {
    if (song) {
      const shareUrl = `${window.location.origin}?url=${encodeURIComponent(song.sourceUrl)}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Share link copied to clipboard!');
      }, () => {
        alert('Failed to copy share link.');
      });
    }
  };

  const totalIsLoading = isLoading || isProcessing;

  return (
    <div className="p-4 bg-gray-800">
      <h2 className="text-white text-lg mb-2">Load a song from URL</h2>
      <div className="flex space-x-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter Bilibili, YouTube, or NetEase URL"
          className="flex-grow p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={totalIsLoading}
        />
        <button
          onClick={handleFetch}
          className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-bold disabled:bg-gray-500"
          disabled={totalIsLoading}
        >
          {totalIsLoading ? 'Loading...' : 'Load'}
        </button>
        <button
          onClick={handleShare}
          className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-500 text-white font-bold disabled:bg-gray-500"
          disabled={!song}
        >
          Share
        </button>
      </div>
      {error && <p className="text-red-500 mt-2">Error: {error}</p>}
    </div>
  );
};


import Link from 'next/link';

const IndexPage = () => {
  const { song, lyrics } = useSongStore();
  const fetchSong = useSongStore((state) => state.actions.fetchSong);
  const { processLyrics } = useLyricsProcessor();
  const currentTime = usePlayerStore((state) => state.currentTime);
  const [mobileView, setMobileView] = useState<'player' | 'lyrics' | 'tutor'>('lyrics');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlFromQuery = params.get('url');
    if (urlFromQuery) {
      fetchSong(urlFromQuery, processLyrics);
    }
  }, [fetchSong, processLyrics]);

  const displayLyrics = lyrics && lyrics.length > 0 ? lyrics : mockLyrics;

  const renderMobileView = () => {
    switch (mobileView) {
      case 'player':
        return (
          <div className="h-full flex flex-col">
            <SongInput />
            <Player song={song} />
          </div>
        );
      case 'lyrics':
        return <LyricsDisplay lyrics={displayLyrics} currentTime={currentTime} />;
      case 'tutor':
        return <AIPanel />;
      default:
        return <LyricsDisplay lyrics={displayLyrics} currentTime={currentTime} />;
    }
  };

  return (
    <>
      <Head>
        <title>J-Melo - Japanese Melodic Learning</title>
        <meta name="description" content="Learn Japanese with your favorite songs." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="bg-gray-900 h-screen flex flex-col">
        {/* Header */}
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

        {/* Content */}
        <div className="flex-grow overflow-hidden">
          {/* Desktop Layout */}
          <div className="hidden lg:grid lg:grid-cols-3 lg:gap-2 h-full">
            <div className="lg:col-span-1 h-full flex flex-col">
              <SongInput />
              <Player song={song} />
            </div>
            <div className="lg:col-span-1 h-full overflow-y-auto">
              <LyricsDisplay lyrics={displayLyrics} currentTime={currentTime} />
            </div>
            <div className="lg:col-span-1 h-full">
              <AIPanel />
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden h-full flex flex-col">
            <div className="flex-grow overflow-y-auto">
              {renderMobileView()}
            </div>
            <div className="flex justify-around p-2 bg-gray-800">
              <button onClick={() => setMobileView('player')} className={`px-4 py-2 rounded ${mobileView === 'player' ? 'bg-green-500' : ''}`}>Player</button>
              <button onClick={() => setMobileView('lyrics')} className={`px-4 py-2 rounded ${mobileView === 'lyrics' ? 'bg-green-500' : ''}`}>Lyrics</button>
              <button onClick={() => setMobileView('tutor')} className={`px-4 py-2 rounded ${mobileView === 'tutor' ? 'bg-green-500' : ''}`}>Tutor</button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default IndexPage;
