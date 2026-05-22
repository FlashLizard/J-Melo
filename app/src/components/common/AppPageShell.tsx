import Head from 'next/head';
import Link from 'next/link';
import React from 'react';
import cn from 'classnames';

interface AppPageShellProps {
  title: string;
  documentTitle?: string;
  backHref?: string;
  backLabel?: string;
  maxWidth?: string;
  containerClassName?: string;
  children: React.ReactNode;
}

const AppPageShell: React.FC<AppPageShellProps> = ({
  title,
  documentTitle,
  backHref = '/',
  backLabel,
  maxWidth = 'max-w-5xl',
  containerClassName,
  children
}) => (
  <>
    <Head>
      <title>{documentTitle || `J-Melo - ${title}`}</title>
    </Head>
    <main className="jm-page min-h-screen pb-12 selection:bg-indigo-500/30">
      <div className={cn('jm-page-container', maxWidth, containerClassName)}>
        <header className="jm-page-header">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="jm-logo-tile">
              <img src="/logo.svg" alt="J-Melo Logo" className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow-md" />
            </div>
            <h1 className="jm-page-title">{title}</h1>
          </div>
          <Link href={backHref} className="jm-icon-button" title={backLabel} aria-label={backLabel || 'Back'}>
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
        </header>
        {children}
      </div>
    </main>
  </>
);

export default AppPageShell;
