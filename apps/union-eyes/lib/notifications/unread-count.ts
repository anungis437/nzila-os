/**
 * The unread count of the signed-in user's inbox (GET /api/notifications/count), read for browser code, and the signal that tells the bell the
 * inbox changed.
 *
 * withApi answers { success, data: { count }, timestamp }. An answer that is not that shape is an error for the bell to report as "could not load",
 * never a count of zero: a broken count must not look like an empty inbox.
 */
import { ApiShapeError, envelopeData } from '@/lib/client/api-envelope';

export function unreadCountFrom(body: unknown): number {
  const { count } = envelopeData(body);
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) throw new ApiShapeError('count is not a count');
  return count;
}

/** Fired on `window` when this tab changed what the inbox holds (a notification marked read or deleted, or all marked read). */
export const INBOX_CHANGED_EVENT = 'ue:inbox-changed';

export function announceInboxChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(INBOX_CHANGED_EVENT));
}

/** Calls `listener` whenever the inbox changed in this tab; returns the function that stops it. */
export function onInboxChanged(listener: () => void): () => void {
  window.addEventListener(INBOX_CHANGED_EVENT, listener);
  return () => window.removeEventListener(INBOX_CHANGED_EVENT, listener);
}
