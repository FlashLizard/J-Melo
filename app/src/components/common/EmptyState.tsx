import React from 'react';
import cn from 'classnames';

type EmptyStateIcon = 'music' | 'book' | 'search';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: EmptyStateIcon;
  className?: string;
}

const iconPathByType: Record<EmptyStateIcon, string> = {
  music: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
};

const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon = 'music', className }) => (
  <div className={cn('jm-empty-state', className)}>
    <div className="jm-empty-icon">
      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPathByType[icon]} />
      </svg>
    </div>
    <p className="text-lg sm:text-xl text-gray-200 font-semibold mb-2">{title}</p>
    {description && <p className="text-sm text-gray-500">{description}</p>}
  </div>
);

export default EmptyState;
