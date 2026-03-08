// src/components/tutor/LyricsAlignmentPanel.tsx
import React, { useState, useEffect } from 'react';
import useSongStore from '@/stores/useSongStore';
import useSettingsStore from '@/stores/useSettingsStore';
import useUIPanelStore from '@/stores/useUIPanelStore';
import useTranslation from '@/hooks/useTranslation';
import { formatLyricTimings } from '@/utils/lyricsProcessor';
import toast from 'react-hot-toast';
import cn from 'classnames';

const LyricsAlignmentPanel: React.FC = () => {
  const { song, setProcessedLyrics, lyrics } = useSongStore();
  const { settings } = useSettingsStore();
  const { setActivePanel, activePanel } = useUIPanelStore();
  const { t } = useTranslation();

  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [extractVocals, setExtractVocals] = useState(false);
  const [replaceWithKana, setReplaceWithKana] = useState(false);

  // Reset status when panel becomes active
  useEffect(() => {
    if (activePanel === 'LYRICS_ALIGNMENT_PANEL') {
        setStatus('idle');
        setMessage('');
        setTaskId(null);
    }
  }, [activePanel]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (status === 'queued' || status === 'processing') {
      intervalId = setInterval(async () => {
        if (!taskId) return;
        try {
          const res = await fetch(`${settings.backendUrl}/api/lyrics/align-status/${taskId}`);
          if (!res.ok) throw new Error('Failed to check status');
          const data = await res.json();
          
          setStatus(data.status);
          setMessage(data.message);

          if (data.status === 'completed') {
            clearInterval(intervalId);
            const alignedLyrics = formatLyricTimings(data.result.segments);
            setProcessedLyrics(alignedLyrics);
            toast.success(t('lyricsAlignment.success'));
          } else if (data.status === 'failed') {
            clearInterval(intervalId);
            toast.error(t('lyricsAlignment.failed').replace('{{message}}', data.message));
          }
        } catch (err) {
          console.error(err);
        }
      }, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [status, taskId, settings.backendUrl, setProcessedLyrics, t]);

  const handleStartAlignment = async () => {
    if (!song || !song.id) return;
    
    if (!lyrics || lyrics.length === 0) {
        toast.error(t('lyricsAlignment.noLyricsError'));
        return;
    }

    setStatus('queued');
    setMessage('Initializing task...');
    
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

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTaskId(data.task_id);
    } catch (err) {
      setStatus('failed');
      setMessage((err as Error).message);
      toast.error('Failed to start alignment task.');
    }
  };

  const resetTask = () => {
    setStatus('idle');
    setMessage('');
    setTaskId(null);
  };

  return (
    <div className="bg-gray-800 p-4 sm:p-5 rounded-2xl h-full flex flex-col text-white border border-gray-700/50 shadow-xl overflow-hidden">
      <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-700/50 flex-shrink-0">
        <h2 className="text-xl font-bold tracking-wide">{t('lyricsAlignment.modalTitle')}</h2>
        <button 
            onClick={() => setActivePanel('TOOL_PANEL')} 
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            {t('common.back')}
        </button>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
        <p className="text-gray-400 text-sm mb-6 px-1 leading-relaxed">
          {t('lyricsAlignment.modalDescription')}
        </p>

        {status === 'idle' ? (
          <div className="space-y-6">
            {/* Mode Selection Placeholder (Always Word for now) */}
            <div className="px-1">
              <div className="p-4 rounded-2xl border-2 border-blue-500/30 bg-blue-500/5 text-blue-100 shadow-sm">
                <div className="font-bold mb-1 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  {t('lyricsAlignment.modeWord')}
                </div>
                <div className="text-xs opacity-70 leading-relaxed">
                    {t('lyricsAlignment.modeWordDesc')}
                </div>
              </div>
            </div>

            <div className="px-1 space-y-6">
              {/* Extract Vocals */}
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

              {/* Replace with Kana */}
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
            
            <div className="bg-blue-900/20 border border-blue-800/30 p-4 rounded-2xl text-sm text-blue-200 flex gap-3 shadow-inner">
               <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               <p className="leading-relaxed">{t('lyricsAlignment.notice')}</p>
            </div>

            <button
              onClick={handleStartAlignment}
              className="w-full py-4 mt-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
            >
              {t('lyricsAlignment.startButton')}
            </button>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500">
            <div className="relative">
              <div className={cn("w-20 h-20 border-4 rounded-full", 
                status === 'completed' ? "border-green-500/20" : "border-blue-500/20 border-t-blue-500 animate-spin"
              )}></div>
              {status === 'completed' && (
                  <div className="absolute inset-0 flex items-center justify-center text-green-500 animate-in zoom-in duration-300">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
              )}
              {status === 'failed' && (
                  <div className="absolute inset-0 flex items-center justify-center text-red-500 animate-in zoom-in duration-300">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
              )}
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white capitalize tracking-wide">{status}...</div>
              <div className="text-gray-400 mt-2 px-4 leading-relaxed">{message}</div>
            </div>

            {(status === 'completed' || status === 'failed') && (
              <button 
                onClick={resetTask}
                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold transition-all active:scale-95 shadow-md"
              >
                {status === 'completed' ? t('lyricsAlignment.doneButton') : t('lyricsAlignment.retryButton')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LyricsAlignmentPanel;
