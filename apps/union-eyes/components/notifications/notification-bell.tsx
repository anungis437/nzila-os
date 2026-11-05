'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { onInboxChanged, unreadCountFrom } from '@/lib/notifications/unread-count';

/** How often the count is read while the tab is in view. */
export const BELL_POLL_MS = 60_000;
/** A burst of changes (several notifications marked read one after another) is read once, this long after the last of them. */
export const BELL_CHANGE_DEBOUNCE_MS = 300;
/** Coming back to the tab reads again only when the last read is older than this. */
export const BELL_FRESH_MS = 15_000;

/**
 * What the bell knows. `failed` is a count that could not be read (no number is shown, because a guess would look like a fact); `stale` is the last
 * count that was read, kept while a later read fails and marked as possibly out of date. Neither is ever shown as zero.
 */
type Unread = { state: 'loading' } | { state: 'ready'; count: number } | { state: 'stale'; count: number } | { state: 'failed' };

async function readUnread(signal: AbortSignal): Promise<number> {
  const response = await fetch('/api/notifications/count', { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`the count was refused with status ${response.status}`);
  return unreadCountFrom(await response.json());
}

/** The bell in the header: a link to where the person's inbox is (`path`, an in-app path without a locale) that carries the unread count the server reports. */
export function NotificationBell({ path }: { path: string }) {
  const t = useTranslations('notificationBell');
  const locale = useLocale();
  const [unread, setUnread] = useState<Unread>({ state: 'loading' });

  useEffect(() => {
    let disposed = false;
    let inFlight: AbortController | null = null;
    // A change that arrives while a read is under way is read once more when that one ends: the count always catches up, and never two at a time.
    let readAgain = false;
    let lastRead = 0;
    let poll: ReturnType<typeof setInterval> | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const read = async (): Promise<void> => {
      if (inFlight) {
        readAgain = true;
        return;
      }
      const controller = new AbortController();
      inFlight = controller;
      try {
        const count = await readUnread(controller.signal);
        if (!disposed) setUnread({ state: 'ready', count });
      } catch {
        if (!disposed) setUnread((before) => (before.state === 'ready' || before.state === 'stale' ? { state: 'stale', count: before.count } : { state: 'failed' }));
      } finally {
        lastRead = Date.now();
        inFlight = null;
        if (readAgain && !disposed) {
          readAgain = false;
          void read();
        }
      }
    };

    const inView = () => document.visibilityState !== 'hidden';
    const startPolling = () => {
      if (poll === null && inView()) poll = setInterval(() => void read(), BELL_POLL_MS);
    };
    const stopPolling = () => {
      if (poll !== null) clearInterval(poll);
      poll = null;
    };

    // A tab out of view reads nothing; coming back reads at once unless the count is fresh.
    const onVisibility = () => {
      if (!inView()) {
        stopPolling();
        return;
      }
      startPolling();
      if (Date.now() - lastRead >= BELL_FRESH_MS) void read();
    };
    const onChange = () => {
      if (debounce !== null) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        void read();
      }, BELL_CHANGE_DEBOUNCE_MS);
    };

    void read();
    startPolling();
    document.addEventListener('visibilitychange', onVisibility);
    const stopListening = onInboxChanged(onChange);
    return () => {
      disposed = true;
      inFlight?.abort();
      stopPolling();
      if (debounce !== null) clearTimeout(debounce);
      document.removeEventListener('visibilitychange', onVisibility);
      stopListening();
    };
  }, []);

  const label =
    unread.state === 'ready'
      ? unread.count === 0
        ? t('none')
        : t('unread', { count: unread.count })
      : unread.state === 'stale'
        ? t('stale', { count: unread.count })
        : unread.state === 'failed'
          ? t('failed')
          : t('title');

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link href={`/${locale}${path}`} aria-label={label} title={label} data-unread-state={unread.state}>
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread.state === 'ready' && unread.count > 0 && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
            {unread.count > 99 ? '99+' : unread.count}
          </span>
        )}
        {unread.state === 'stale' && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-semibold text-black">
            {unread.count > 99 ? '99+' : unread.count}
          </span>
        )}
        {unread.state === 'failed' && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-black">
            !
          </span>
        )}
      </Link>
    </Button>
  );
}
