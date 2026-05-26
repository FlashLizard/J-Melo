// src/components/tutor/PetitLyricsImporter.tsx
import React, { useState, useEffect } from 'react';
import useSongStore from '@/stores/useSongStore';
import useSettingsStore from '@/stores/useSettingsStore';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useTranslation from '@/hooks/useTranslation';
import { formatLyricTimings } from '@/utils/lyricsProcessor';
import toast from 'react-hot-toast';
import cn from 'classnames';
import { getJson } from '@/lib/backendClient';

type PetitLyricsSearchResult = {
  lyricsId: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number | null;
  lyricsType: 'word' | 'sentence' | 'none';
};

const formatDuration = (duration?: number | null) => {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return null;
  const totalSeconds = Math.round(duration);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const PetitLyricsImporter: React.FC = () => {
  const { song, setProcessedLyrics, updateSongInfo } = useSongStore();
  const { settings } = useSettingsStore();
  const { setActivePanel, activePanel } = useUIPanelStore();
  const { t } = useTranslation();

  const [step, setStep] = useState<'title' | 'search' | 'loading' | 'success'>('title');
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [results, setResults] = useState<PetitLyricsSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activePanel === 'PETIT_LYRICS_IMPORTER' && song) {
      setSongTitle(song.title || '');
      setSongArtist(song.artist || '');
      setStep('title');
      setError(null);
    }
  }, [activePanel, song]);

  const handleConfirmTitle = async () => {
    if (!songTitle.trim()) {
        toast.error(t('songInfoEditor.titlePlaceholder'));
        return;
    }
    // Update local DB ONLY if title changed
    if (song && songTitle !== song.title) {
        await updateSongInfo({ title: songTitle });
    }
    handleSearch();
  };

  const handleSearch = async () => {
    setStep('search');
    setIsSearching(true);
    setError(null);
    try {
      const data = await getJson<{ results: PetitLyricsSearchResult[] }>(settings.backendUrl, '/api/lyrics/search-petitlyrics', {
        q: songTitle,
        artist: songArtist,
      });
      setResults(data.results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLyric = async (lyricsId: string) => {
    setStep('loading');
    setError(null);
    try {
      const data = await getJson<{ lyrics_data: any[] }>(settings.backendUrl, '/api/lyrics/fetch-petitlyrics', {
        lyrics_id: lyricsId,
      });
      
      const processed = formatLyricTimings(data.lyrics_data);
      setProcessedLyrics(processed);
      setStep('success');
      toast.success(t('petitLyrics.success'));
    } catch (err) {
      setError((err as Error).message);
      setStep('search');
    }
  };

  return (
    <div className="bg-gray-800 p-4 sm:p-5 rounded-2xl h-full flex flex-col text-white border border-gray-700/50 shadow-xl overflow-hidden">
      <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-700/50 flex-shrink-0">
        <h2 className="text-xl font-bold tracking-wide">{t('petitLyrics.title')}</h2>
        <button 
            onClick={() => setActivePanel('TOOL_PANEL')} 
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            {t('common.back')}
        </button>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
        {step === 'title' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-4 rounded-xl bg-indigo-900/20 border border-indigo-800/30 text-xs text-indigo-300 leading-relaxed shadow-inner">
                <div className="flex gap-2 mb-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="font-bold uppercase tracking-wider">{t('petitLyrics.searchTipTitle')}</span>
                </div>
                <p>{t('petitLyrics.searchTipContent')}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">{t('songInfoEditor.titleLabel')}</label>
                <input 
                  type="text" 
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  className="w-full p-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none transition-colors"
                  placeholder={t('songInfoEditor.titlePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">{t('songInfoEditor.artistLabel')}</label>
                <input 
                  type="text" 
                  value={songArtist}
                  onChange={(e) => setSongArtist(e.target.value)}
                  className="w-full p-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none transition-colors"
                  placeholder={t('songInfoEditor.artistPlaceholder')}
                />
              </div>
            </div>
            <button
              onClick={handleConfirmTitle}
              className="w-full py-4 mt-4 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-all shadow-lg active:scale-[0.98]"
            >
              {t('common.search')}
            </button>
          </div>
        )}

        {step === 'search' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="p-3 rounded-xl bg-amber-900/20 border border-amber-800/30 text-[10px] text-amber-200/70 leading-tight italic">
                {t('petitLyrics.timingWarning')}
            </div>

            <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-indigo-300">{t('index.searchTitle')}</h3>
                <button onClick={() => setStep('title')} className="text-xs text-gray-400 hover:text-white underline">{t('toolPanel.editInfoButton')}</button>
            </div>
            
            {isSearching ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <p className="text-gray-400 animate-pulse">{t('index.searchingStatus')}</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-900/20 border border-red-800 rounded-xl text-red-300 text-sm">
                {error}
                <button onClick={handleSearch} className="block mt-2 font-bold underline">{t('common.retry')}</button>
              </div>
            ) : results.length === 0 ? (
              <div className="py-20 text-center text-gray-500">
                {t('petitLyrics.noResults')}
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((res, idx) => {
                  const durationText = formatDuration(res.duration);
                  return (
                    <button
                      key={res.lyricsId || idx}
                      onClick={() => handleSelectLyric(res.lyricsId)}
                      className="w-full text-left p-4 rounded-xl bg-gray-700/40 hover:bg-gray-700 border border-gray-700 hover:border-indigo-500 transition-all group"
                    >
                      <div className="flex justify-between items-start gap-3 mb-1">
                          <span className="font-bold text-gray-100 group-hover:text-indigo-300 transition-colors line-clamp-1 min-w-0">{res.title}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {durationText && (
                              <span className="text-[10px] px-2 py-0.5 rounded font-bold tabular-nums bg-gray-900/70 text-gray-300 border border-gray-600/70">
                                  {durationText}
                              </span>
                            )}
                            <span className={cn("text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider",
                                res.lyricsType === 'word' ? "bg-emerald-900/40 text-emerald-400 border border-emerald-800/50" :
                                res.lyricsType === 'sentence' ? "bg-blue-900/40 text-blue-400 border border-blue-800/50" :
                                "bg-gray-800 text-gray-500"
                            )}>
                                {res.lyricsType === 'word' ? 'Word-level' : (res.lyricsType === 'sentence' ? 'Sentence-level' : 'No Timeline')}
                            </span>
                          </div>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-1">{res.artist} {res.album && `• ${res.album}`}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 'loading' && (
          <div className="py-20 flex flex-col items-center justify-center space-y-6">
            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <div className="text-center">
              <h3 className="text-xl font-bold">{t('index.searchingStatus')}</h3>
              <p className="text-gray-400 mt-2">{t('petitLyrics.fetching')}</p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold">{t('petitLyrics.success')}</h3>
              <p className="text-gray-400 mt-2 px-6">{t('petitLyrics.successDescription')}</p>
            </div>
            <button 
              onClick={() => setActivePanel('TOOL_PANEL')}
              className="px-10 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
            >
              {t('common.done')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PetitLyricsImporter;
