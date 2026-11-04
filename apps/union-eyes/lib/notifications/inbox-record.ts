/**
 * The in-app inbox as GET /api/notifications answers it, read for browser code.
 *
 * withApi sends { success, data: { notifications, unreadCount, pagination }, timestamp }; each notification is a row of in_app_notifications. An
 * answer that is not that shape is an error for the screen to report, never an empty inbox and never an unread count of zero: a broken inbox must
 * not look like an empty one.
 */
import { ApiShapeError, envelopeData } from '@/lib/client/api-envelope';
import { envelopeTotal } from '@/lib/client/list-total';
import { asRecord, optionalString, requiredCount, requiredString } from '@/lib/client/row-fields';

export interface NotificationRecord {
  id: string;
  /** The type column: free text whose writers use info, success, warning or error. */
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl: string | null;
  actionLabel: string | null;
}

export interface Inbox {
  /** The newest notifications that match the filter (a page of at most 100). */
  notifications: NotificationRecord[];
  /** Every unread notification the caller has, whatever the filter says. */
  unreadCount: number;
  /** Every notification that matches the filter, of which `notifications` holds the newest page. */
  total: number;
}

// title and message are NOT NULL text; a writer is bound to non-empty text but an empty one is still a stored value, not a missing one.
function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') throw new ApiShapeError(`${key} is missing`);
  return value;
}

export function notificationFrom(value: unknown): NotificationRecord {
  const row = asRecord(value, 'notification');
  const { read } = row;
  if (typeof read !== 'boolean') throw new ApiShapeError('read is not a boolean');
  return {
    id: requiredString(row, 'id'),
    type: requiredString(row, 'type'),
    title: text(row, 'title'),
    message: text(row, 'message'),
    read,
    createdAt: requiredString(row, 'createdAt'),
    actionUrl: optionalString(row, 'actionUrl'),
    actionLabel: optionalString(row, 'actionLabel'),
  };
}

export function inboxFrom(body: unknown): Inbox {
  const payload = envelopeData(body);
  if (!Array.isArray(payload.notifications)) throw new ApiShapeError('no notifications');
  const unreadCount = requiredCount(payload, 'unreadCount');
  if (!Number.isInteger(unreadCount) || unreadCount < 0) throw new ApiShapeError('unreadCount is not a count');
  return { notifications: payload.notifications.map(notificationFrom), unreadCount, total: envelopeTotal(body) };
}
