'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface SyncStatusProps {
  className?: string;
  showDetails?: boolean;
}

type SyncState = 'idle' | 'syncing' | 'error' | 'success';

/**
 * SyncStatus component showing current sync state
 * Displays progress, errors, and last sync time
 */
export function SyncStatus({ className, showDetails = false }: SyncStatusProps) {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check for stored sync state
    const storedLastSync = localStorage.getItem('lastSyncTime');
    if (storedLastSync) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastSync(new Date(storedLastSync));
    }

    // Listen for sync events from service worker
    const handleSyncEvent = (event: CustomEvent<{ state: SyncState; error?: string }>) => {
      setSyncState(event.detail.state);
      if (event.detail.error) {
        setErrorMessage(event.detail.error);
      }
      
      if (event.detail.state === 'success') {
        setLastSync(new Date());
        localStorage.setItem('lastSyncTime', new Date().toISOString());
      }
    };

    // Add event listener for sync events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.addEventListener('sync-status' as any, handleSyncEvent as EventListener);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.removeEventListener('sync-status' as any, handleSyncEvent as EventListener);
    };
  }, []);

  const formatLastSync = (date: Date | null): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Status indicator */}
      <div
        className={cn(
          'w-2 h-2 rounded-full',
          syncState === 'idle' && 'bg-gray-400',
          syncState === 'syncing' && 'bg-blue-500 animate-pulse',
          syncState === 'error' && 'bg-red-500',
          syncState === 'success' && 'bg-green-500'
        )}
        title={
          syncState === 'idle' ? 'Ready to sync' :
          syncState === 'syncing' ? 'Syncing...' :
          syncState === 'error' ? `Sync error: ${errorMessage}` :
          'Synced'
        }
      />

      {/* Status text */}
      {showDetails && (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-600">
            {syncState === 'idle' && 'Ready'}
            {syncState === 'syncing' && 'Syncing...'}
            {syncState === 'error' && 'Sync failed'}
            {syncState === 'success' && 'Synced'}
          </span>
          
          {lastSync && (
            <span className="text-xs text-gray-400">
              Last: {formatLastSync(lastSync)}
            </span>
          )}
          
          {syncState === 'error' && errorMessage && (
            <span className="text-xs text-red-500 truncate max-w-[150px]">
              {errorMessage}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact sync status with icon button
 */
export function SyncStatusButton({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');

  useEffect(() => {
    const handleSyncEvent = (event: CustomEvent<{ state: SyncState }>) => {
      setSyncState(event.detail.state);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.addEventListener('sync-status' as any, handleSyncEvent as EventListener);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.removeEventListener('sync-status' as any, handleSyncEvent as EventListener);
    };
  }, []);

  const handleClick = async () => {
    if (!isOpen) {
      setIsOpen(true);
      return;
    }

    // Trigger manual sync
    try {
      setSyncState('syncing');
      const response = await fetch('/api/mobile/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: localStorage.getItem('deviceId') || 'unknown',
          platform: 'pwa',
        }),
      });

      if (response.ok) {
        setSyncState('success');
      } else {
        setSyncState('error');
      }
    } catch {
      setSyncState('error');
    }

    setIsOpen(false);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center justify-center w-8 h-8 rounded-full',
        'hover:bg-gray-100 transition-colors',
        syncState === 'syncing' && 'animate-spin',
        className
      )}
      title="Sync now"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
      </svg>
    </button>
  );
}

export default SyncStatus;
