// src/components/tutor/LyricsWizardPanel.tsx
import React, { useState, useEffect } from 'react';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useSongStore from '@/stores/useSongStore';
import useSettingsStore from '@/stores/useSettingsStore';
import useTranslation from '@/hooks/useTranslation';
import { formatLyricTimings } from '@/utils/lyricsProcessor';
import toast from 'react-hot-toast';
import cn from 'classnames';

const LyricsWizardPanel: React.FC = () => {
  const { isLyricsWizardOpen, setIsLyricsWizardOpen } = useUIPanelStore();
  const { song, updateSongInfo, setProcessedLyrics, lyrics } = useSongStore();
  const { settings } = useSettingsStore();
  const { t } = useTranslation();

  const [step, setStep] = useState(1);
  const [editedTitle, setEditedTitle] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [fetchUrl, setFetchUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  
  // Alignment state
  const [isAligning, setIsSearchingAlign] = useState(false);
  const [alignStatus, setAlignStatus] = useState('');
  const [extractVocals, setExtractVocals] = useState(false);
  const [replaceWithKana, setReplaceWithKana] = useState(false);

  useEffect(() => {
    if (song && isLyricsWizardOpen) {
      setEditedTitle(song.title);
      setStep(1);
    }
  }, [song, isLyricsWizardOpen]);

  if (!isLyricsWizardOpen || !song) return null;

  const handleConfirmTitle = async () => {
    await updateSongInfo({ title: editedTitle });
    setIsSearching(true);
    try {
      const res = await fetch(`${settings.backendUrl}/api/lyrics/search-utaten?q=${encodeURIComponent(editedTitle)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
      setStep(2);
    } catch (e) {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFetchLyrics = async (url: string) => {
    setFetchUrl(url);
    setIsFetching(true);
    try {
      const res = await fetch(`${settings.backendUrl}/api/lyrics/fetch-utaten?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setProcessedLyrics(data.lyrics_data);
      setStep(3);
    } catch (e) {
      toast.error('Failed to fetch lyrics');
    } finally {
      setIsFetching(false);
    }
  };

  const handleStartAlignment = async () => {
    setIsSearchingAlign(true);
    setAlignStatus('Initializing...');
    try {
      const res = await fetch(`${settings.backendUrl}/api/lyrics/align`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song_id: song.id,
          source_url: song.sourceUrl,
          local_path: (song as any).local_path,
          lyrics_data: lyrics,
          align_mode: 'word',
          extract_vocals: extractVocals,
          replace_with_kana: replaceWithKana
        })
      });
      const { task_id } = await res.json();
      
      const checkStatus = setInterval(async () => {
        const sRes = await fetch(`${settings.backendUrl}/api/lyrics/align-status/${task_id}`);
        const sData = await sRes.json();
        setAlignStatus(sData.message);
        if (sData.status === 'completed') {
          clearInterval(checkStatus);
          setProcessedLyrics(formatLyricTimings(sData.result.segments));
          setIsSearchingAlign(false);
          setStep(4);
          toast.success(t('lyricsWizard.successMessage'));
        } else if (sData.status === 'failed') {
          clearInterval(checkStatus);
          setIsSearchingAlign(false);
          toast.error('Alignment failed: ' + sData.message);
        }
      }, 2000);
    } catch (e) {
      setIsSearchingAlign(false);
      toast.error('Failed to start alignment');
    }
  };

  const StepBadge: React.FC<{ num: number; active: boolean }> = ({ num, active }) => (
    <div className={cn(
      "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300",
      active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 scale-110" : "bg-gray-700 text-gray-500"
    )}>
      {num}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-gray-900 border border-gray-700/50 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 rounded-xl">
                <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            {t('lyricsWizard.title')}
          </h2>
          <button onClick={() => setIsLyricsWizardOpen(false)} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-all">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-8 py-6 bg-gray-800/30 flex justify-between items-center relative">
          <div className="absolute left-8 right-8 h-0.5 bg-gray-700 top-1/2 -translate-y-1/2 z-0"></div>
          <div className="absolute left-8 h-0.5 bg-indigo-500 top-1/2 -translate-y-1/2 z-0 transition-all duration-500" style={{ width: `${(step-1)*33.3}%` }}></div>
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="z-10 flex flex-col items-center gap-2">
                <StepBadge num={n} active={step >= n} />
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-8 flex-grow overflow-y-auto custom-scrollbar">
          
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2">
                <label className="text-indigo-400 font-bold text-sm uppercase tracking-wider">{t('lyricsWizard.step1Title')}</label>
                <input 
                  value={editedTitle} 
                  onChange={e => setEditedTitle(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4 text-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Song Title"
                />
              </div>
              <button 
                onClick={handleConfirmTitle}
                disabled={isSearching}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
              >
                {isSearching ? <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full"></div> : t('lyricsWizard.searchButton')}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-500">
              <label className="text-indigo-400 font-bold text-sm uppercase tracking-wider block mb-2">{t('lyricsWizard.step2Title')}</label>
              <div className="grid gap-3">
                {searchResults.length > 0 ? searchResults.map((r, i) => (
                  <button 
                    key={i}
                    onClick={() => handleFetchLyrics(r.url)}
                    className="flex flex-col p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl text-left transition-all group relative overflow-hidden"
                  >
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </div>
                    <span className="font-bold text-white group-hover:text-indigo-300 transition-colors">{r.title}</span>
                    <span className="text-sm text-gray-400">{r.artist}</span>
                  </button>
                )) : (
                  <div className="text-center py-12 text-gray-500 bg-gray-800/50 rounded-2xl border border-dashed border-gray-700">
                    {t('lyricsWizard.noResults')}
                  </div>
                )}
              </div>
              <button onClick={() => setStep(1)} className="w-full py-3 text-gray-400 hover:text-white font-medium transition-colors underline decoration-gray-700 underline-offset-4">{t('aiLyricCorrector.backButton')}</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="space-y-4">
                <label className="text-indigo-400 font-bold text-sm uppercase tracking-wider">{t('lyricsWizard.step4Title')}</label>
                
                <div className="grid gap-4 bg-gray-800/50 p-6 rounded-3xl border border-gray-700">
                  {/* Extract Vocals Checkbox */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={extractVocals}
                          onChange={(e) => setExtractVocals(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                      </div>
                      <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                        {t('lyricsAlignment.extractVocalsLabel')}
                      </span>
                    </label>
                    <p className="text-[10px] text-amber-400/70 italic leading-tight ml-14">
                      {t('lyricsAlignment.extractVocalsHint')}
                    </p>
                  </div>

                  {/* Replace with Kana Checkbox */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={replaceWithKana}
                          onChange={(e) => setReplaceWithKana(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                      </div>
                      <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                        {t('lyricsAlignment.replaceWithKanaLabel')}
                      </span>
                    </label>
                    <p className="text-[10px] text-indigo-300/70 italic leading-tight ml-14">
                      {t('lyricsAlignment.replaceWithKanaHint')}
                    </p>
                  </div>
                </div>
              </div>

              {isAligning ? (
                <div className="flex flex-col items-center py-8 gap-4">
                  <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 animate-spin rounded-full"></div>
                  <div className="text-indigo-300 font-medium animate-pulse">{alignStatus}</div>
                </div>
              ) : (
                <button 
                  onClick={handleStartAlignment}
                  className="w-full py-5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-indigo-600/20 transition-all transform active:scale-[0.98]"
                >
                  {t('lyricsWizard.alignButton')}
                </button>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center py-12 space-y-6 animate-in zoom-in duration-500 text-center">
              <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">{t('lyricsAlignment.success')}</h3>
                <p className="text-gray-400">{t('lyricsWizard.successMessage')}</p>
              </div>
              <button 
                onClick={() => setIsLyricsWizardOpen(false)}
                className="px-12 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-2xl transition-all"
              >
                {t('lyricsAlignment.doneButton')}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default LyricsWizardPanel;
