// src/components/common/SongInput.tsx
import React, { useState } from 'react';
import useSongStore from '@/stores/useSongStore';
import useTranslation from '@/hooks/useTranslation';
import cn from 'classnames';

const SongInput: React.FC = () => {
    const { fetchSong, isLoading } = useSongStore();
    const { t } = useTranslation();
    const [url, setUrl] = useState('');
    const [mode, setMode] = useState<'url' | 'search'>('url');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleFetch = async (targetUrl?: string) => {
        const urlToFetch = targetUrl || url;
        if (!urlToFetch.trim()) return;
        await fetchSong(urlToFetch);
        if (!targetUrl) setUrl('');
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const res = await fetch(`http://localhost:8000/api/search?q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            setSearchResults(data.results || []);
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setIsSearching(false);
        }
    };

    const selectResult = (resultUrl: string) => {
        setUrl(resultUrl);
        handleFetch(resultUrl);
    };

    return (
      <div className="bg-gray-800/40 backdrop-blur-md rounded-3xl border border-gray-700/50 overflow-hidden mb-10 transition-all shadow-xl">
        {/* Tab Selectors */}
        <div className="flex bg-gray-900/30 p-1.5">
          <button
              onClick={() => setMode('url')}
              className={cn(
                  "flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 rounded-2xl", 
                  mode === 'url' ? "bg-gray-800 text-emerald-400 shadow-md border border-gray-700/50" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/30"
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
                  "flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 rounded-2xl", 
                  mode === 'search' ? "bg-gray-800 text-indigo-400 shadow-md border border-gray-700/50" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/30"
              )}
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {t('index.platformYoutube')}
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {mode === 'url' ? (
              <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-grow">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826L10.242 10.242m-4.242 4.242l4.242-4.242M9.828 5.172a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102 1.101m.758-4.826L13.758 13.758" /></svg>
                      </div>
                      <input
                          type="text"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder={t('index.enterSongUrl')}
                          className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-900/50 border border-gray-700/50 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-inner placeholder-gray-600"
                          disabled={isLoading}
                      />
                  </div>
                  <button
                      onClick={() => handleFetch()}
                      className="px-10 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:bg-gray-700 disabled:text-gray-500 transition-all flex items-center justify-center min-w-[140px] shadow-lg shadow-emerald-900/20 active:scale-95 border border-emerald-500/30"
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
                      <div className="relative flex-grow">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          </div>
                          <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder={t('index.searchPlaceholder')}
                              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-900/50 border border-gray-700/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner placeholder-gray-600"
                              disabled={isSearching}
                          />
                      </div>
                      <button
                          type="submit"
                          className="px-10 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:bg-gray-700 disabled:text-gray-500 transition-all flex items-center justify-center min-w-[140px] shadow-lg shadow-indigo-900/20 active:scale-95 border border-indigo-500/30"
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

                  {searchResults.length > 0 && (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar animate-in fade-in duration-300">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1 mb-3">{t('index.searchTitle')}</p>
                          {searchResults.map((result, i) => (
                              <div 
                                  key={i} 
                                  onClick={() => selectResult(result.url)}
                                  className="flex items-center gap-4 p-3 rounded-2xl bg-gray-900/40 border border-gray-700/30 hover:bg-gray-700/50 hover:border-gray-600 cursor-pointer transition-all group"
                              >
                                  <div className="w-24 h-16 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 shadow-sm border border-gray-700/50">
                                      <img src={result.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                  </div>
                                  <div className="flex-grow min-w-0 pr-2">
                                      <p className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors">{result.title}</p>
                                      <p className="text-xs text-gray-500 truncate mt-1">{result.author} • {result.duration_text}</p>
                                  </div>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 pr-2">
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}
        </div>
      </div>
    );
};

export default SongInput;