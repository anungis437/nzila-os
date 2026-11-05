'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface OfflineBannerProps {
  className?: string;
}

/**
 * OfflineBanner component that shows when the device is offline.
 *
 * It states the connection only. Nothing is queued on the device and nothing syncs later, so it never promises that pending changes will be sent:
 * what is typed while offline is not saved until the connection returns and it is submitted again.
 */
export function OfflineBanner({ className }: OfflineBannerProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check initial state
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        'sticky top-0 z-50 bg-red-500 px-4 py-2 text-sm font-medium text-white',
        className
      )}
    >
      <div className="flex items-center justify-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
        <span>You are offline</span>
      </div>
    </div>
  );
}

export default OfflineBanner;
