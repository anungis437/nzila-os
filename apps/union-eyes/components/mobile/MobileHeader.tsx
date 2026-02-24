'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  backHref?: string;
  rightContent?: React.ReactNode;
  className?: string;
}

/**
 * Mobile header component with back button and actions
 * Designed for mobile-first responsive design
 */
export function MobileHeader({
  title,
  showBack = false,
  backHref,
  rightContent,
  className,
}: MobileHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 bg-white border-b border-gray-200',
        'flex items-center justify-between h-14 px-4',
        'safe-area-pt',
        className
      )}
    >
      <div className="flex items-center flex-1 min-w-0">
        {showBack && (
          <Link
            href={backHref || '#'}
            className={cn(
              'flex items-center justify-center w-10 h-10 -ml-2 rounded-full',
              'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
              'transition-colors duration-200'
            )}
            onClick={(e) => {
              if (!backHref) {
                e.preventDefault();
                window.history.back();
              }
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </Link>
        )}
        
        <h1 className={cn(
          'text-lg font-semibold text-gray-900 truncate',
          showBack ? 'ml-1' : 'ml-0'
        )}>
          {title}
        </h1>
      </div>

      {rightContent && (
        <div className="flex items-center justify-end shrink-0 ml-2">
          {rightContent}
        </div>
      )}
    </header>
  );
}

/**
 * MobileHeader with search functionality
 */
interface MobileHeaderSearchProps extends Omit<MobileHeaderProps, 'rightContent'> {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
}

export function MobileHeaderWithSearch({
  title,
  showBack = false,
  backHref,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  showSearch = true,
  className,
}: MobileHeaderSearchProps) {
  const [isSearchVisible, setIsSearchVisible] = React.useState(showSearch);

  if (isSearchVisible) {
    return (
      <MobileHeader
        title=""
        showBack={showBack}
        backHref={backHref}
        className={className}
        rightContent={
          <div className="flex items-center flex-1 max-w-md ml-2">
            <button
              onClick={() => setIsSearchVisible(false)}
              className="p-2 text-gray-500 hover:text-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15,18 9,12 15,6" />
              </svg>
            </button>
            <input
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                'flex-1 px-2 py-1.5 text-sm bg-gray-100 rounded-lg',
                'border-0 focus:outline-none focus:ring-2 focus:ring-blue-500',
                'placeholder:text-gray-400'
              )}
              autoFocus
            />
          </div>
        }
      />
    );
  }

  return (
    <MobileHeader
      title={title}
      showBack={showBack}
      backHref={backHref}
      className={className}
      rightContent={
        <button
          onClick={() => setIsSearchVisible(true)}
          className="p-2 text-gray-500 hover:text-gray-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      }
    />
  );
}

export default MobileHeader;
