'use client';

import { useState, useEffect } from 'react';

export interface NotificationBellProps {
  /** Fetch unread count. */
  fetchUnreadCount: () => Promise<number>;
  /** Called when bell is clicked. */
  onOpen?: () => void;
  /** Polling interval in ms (0 = no polling). */
  pollInterval?: number;
}

export function NotificationBell({
  fetchUnreadCount,
  onOpen,
  pollInterval = 30_000,
}: NotificationBellProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const n = await fetchUnreadCount();
        if (!cancelled) setCount(n);
      } catch {
        // Silently ignore — bell is non-critical UI
      }
    };

    void poll();
    if (pollInterval > 0) {
      const id = setInterval(poll, pollInterval);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [fetchUnreadCount, pollInterval]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
    >
      {/* Bell icon (inline SVG to avoid icon library dependency) */}
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
