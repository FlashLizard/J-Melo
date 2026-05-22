import React from 'react';
import cn from 'classnames';

export type DisplayMode = 'grid' | 'list';

interface SearchDisplayToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onClear?: () => void;
  placeholder: string;
  searchLabel: string;
  clearLabel: string;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  displayModeLabel: string;
  gridLabel: string;
  listLabel: string;
  isLoading?: boolean;
}

const SearchDisplayToolbar: React.FC<SearchDisplayToolbarProps> = ({
  query,
  onQueryChange,
  onSubmit,
  onClear,
  placeholder,
  searchLabel,
  clearLabel,
  displayMode,
  onDisplayModeChange,
  displayModeLabel,
  gridLabel,
  listLabel,
  isLoading = false
}) => {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    onQueryChange('');
  };

  return (
    <div className="jm-toolbar">
      <form onSubmit={handleSubmit} className="flex flex-1 gap-2 sm:gap-3 min-w-0">
        <div className="relative flex-1 min-w-0">
          <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none text-gray-500">
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            className="jm-input w-full pl-9 sm:pl-12 pr-11 py-2.5 sm:py-3 text-sm sm:text-base"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-1.5 my-auto h-8 w-8 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700/80 transition-colors"
              aria-label={clearLabel}
              title={clearLabel}
            >
              <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="jm-icon-button jm-icon-button-primary"
          title={searchLabel}
          aria-label={searchLabel}
        >
          {isLoading ? (
            <svg className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </button>
      </form>

      <div className="jm-segment shrink-0" role="group" aria-label={displayModeLabel}>
        <ModeButton mode="grid" current={displayMode} label={gridLabel} onClick={onDisplayModeChange}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </ModeButton>
        <ModeButton mode="list" current={displayMode} label={listLabel} onClick={onDisplayModeChange}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </ModeButton>
      </div>
    </div>
  );
};

interface ModeButtonProps {
  mode: DisplayMode;
  current: DisplayMode;
  label: string;
  onClick: (mode: DisplayMode) => void;
  children: React.ReactNode;
}

const ModeButton: React.FC<ModeButtonProps> = ({ mode, current, label, onClick, children }) => (
  <button
    type="button"
    onClick={() => onClick(mode)}
    className={cn('jm-segment-button', current === mode && 'is-active')}
    title={label}
    aria-label={label}
    aria-pressed={current === mode}
  >
    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {children}
    </svg>
  </button>
);

export default SearchDisplayToolbar;
