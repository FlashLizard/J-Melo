// app/src/components/common/SongInput.tsx
import React, { useState } from 'react';
import useSongStore from '@/stores/useSongStore';
import useSettingsStore from '@/stores/useSettingsStore';
import useTranslation from '@/hooks/useTranslation';
import { useRouter } from 'next/router';
import cn from 'classnames';

interface SearchResult {
    id: string;
    title: string;
    uploader: string;
    duration: number | null;
    url: string;
    thumbnail: string | null;
}

const SongInput: React.FC = () => {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'url' | 'search'>('url');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { isLoading, error, fetchSong } = useSongStore();
  const { settings } = useSettingsStore();
  const { t } = useTranslation();
  const router = useRouter();

  const handleFetch = async (targetUrl: string = url) => {
    if (targetUrl) {
      await fetchSong(targetUrl);
      const songStore = useSongStore.getState();
      if (songStore.song && songStore.song.id) {
        router.push(`/player/${songStore.song.id}`);
      }
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
        const response = await fetch(`${settings.backendUrl}/api/media/search?q=${encodeURIComponent(searchQuery)}`);
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        setSearchResults(data.results);
    } catch (err) {
        console.error(err);
    } finally {
        setIsSearching(false);
    }
  };

  const selectResult = (resultUrl: string) => {
      setUrl(resultUrl);
      handleFetch(resultUrl);
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden mb-8 transition-all">
      {/* Tab Selectors */}
      <div className="flex border-b border-gray-700">
        <button 
            onClick={() => setMode('url')}
            className={cn(
                "flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2",
                mode === 'url' ? "bg-gray-800 text-green-400 border-b-2 border-green-500" : "bg-gray-900/50 text-gray-500 hover:text-gray-300 hover:bg-gray-900"
            )}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826L10.242 10.242m-4.242 4.242l4.242-4.242M9.828 5.172a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102 1.101m.758-4.826L13.758 13.758" />
            </svg>
            {t('index.loadFromUrl')}
        </button>
        <button 
            onClick={() => setMode('search')}
            className={cn(
                "flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2",
                mode === 'search' ? "bg-gray-800 text-indigo-400 border-b-2 border-indigo-500" : "bg-gray-900/50 text-gray-500 hover:text-gray-300 hover:bg-gray-900"
            )}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {t('index.platformYoutube')}
        </button>
      </div>

      <div className="p-6">
        {mode === 'url' ? (
            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t('index.enterSongUrl')}
                    className="flex-grow p-3 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all shadow-inner"
                    disabled={isLoading}
                />
                <button
                    onClick={() => handleFetch()}
                    className="px-8 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold disabled:bg-gray-700 disabled:text-gray-500 transition-all flex items-center justify-center min-w-[120px]"
                    disabled={isLoading || !url.trim()}
                >
                    {isLoading ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : t('index.loadButton')}
                </button>
            </div>
        ) : (
            <div className="space-y-6">
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('index.searchPlaceholder')}
                        className="flex-grow p-3 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                        autoFocus
                    />
                    <button
                        type="submit"
                        className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:bg-gray-700 disabled:text-gray-500 transition-all flex items-center justify-center min-w-[120px]"
                        disabled={isSearching || !searchQuery.trim()}
                    >
                        {isSearching ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : t('index.searchButton')}
                    </button>
                </form>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="border-t border-gray-700 pt-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider pl-1">{t('index.selectResultHint')}</p>
                        <div className="grid grid-cols-1 gap-3">
                            {searchResults.map((result) => (
                                <div 
                                    key={result.id} 
                                    onClick={() => selectResult(result.url)}
                                    className="flex gap-4 p-3 bg-gray-900/40 rounded-xl hover:bg-gray-700/60 cursor-pointer border border-transparent hover:border-indigo-500 transition-all group relative overflow-hidden"
                                >
                                    <div className="w-32 h-20 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 relative shadow-md">
                                        {result.thumbnail && <img src={result.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" />}
                                        {result.duration && (
                                            <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-[10px] px-1.5 py-0.5 rounded font-bold text-white backdrop-blur-sm">
                                                {Math.floor(result.duration / 60)}:{String(result.duration % 60).padStart(2, '0')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-grow min-w-0 flex flex-col justify-center">
                                        <h3 className="text-sm font-bold text-gray-100 truncate group-hover:text-white leading-snug" title={result.title}>{result.title}</h3>
                                        <p className="text-xs text-gray-400 truncate mt-1.5 flex items-center gap-1.5">
                                            <span className="w-1 h-1 bg-indigo-500 rounded-full"></span>
                                            {result.uploader}
                                        </p>
                                    </div>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {searchResults.length === 0 && !isSearching && searchQuery && (
                    <div className="text-center py-8 bg-gray-900/30 rounded-xl border border-dashed border-gray-700">
                        <p className="text-gray-500 text-sm italic">{t('index.noResultsFound')}</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {error && (
        <div className="px-6 pb-6">
            <div className="flex items-center gap-3 bg-red-900/20 p-4 rounded-xl border border-red-900/50 text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">{error}</span>
            </div>
        </div>
      )}
    </div>
  );
};

export default SongInput;
