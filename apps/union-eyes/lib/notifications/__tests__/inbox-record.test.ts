import { describe, expect, it } from 'vitest';
import { ApiShapeError } from '@/lib/client/api-envelope';
import { inboxFrom, notificationFrom } from '../inbox-record';

// A row of in_app_notifications as GET /api/notifications answers it (every column of the table).
const row = (over: Record<string, unknown> = {}) => ({
  id: '7d9d8a3e-6b1c-4a53-9a2f-0f4e8f7d1b21',
  userId: 'user_2abc',
  organizationId: '0b6f1d7a-3a62-4c6e-8d0b-5a7c9e2f4d11',
  title: 'Your case status was updated',
  message: 'Your case is now under review.',
  type: 'info',
  actionLabel: 'View case',
  actionUrl: '/dashboard/claims/42',
  data: { event: 'case_status_changed', claimId: '42', toStatus: 'under_review' },
  read: false,
  readAt: null,
  createdAt: '2026-03-04T15:00:00.000Z',
  expiresAt: null,
  ...over,
});
// What withApi sends for the list handler's { notifications, unreadCount, pagination }.
const body = (over: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    notifications: [row()],
    unreadCount: 7,
    pagination: { page: 1, limit: 100, total: 12, totalPages: 1 },
    ...over,
  },
  timestamp: '2026-03-04T16:00:00.000Z',
});

describe('inboxFrom', () => {
  it('reads the rows, the unread count of the whole inbox, and the total the route states', () => {
    const inbox = inboxFrom(body());

    expect(inbox.notifications).toEqual([
      {
        id: '7d9d8a3e-6b1c-4a53-9a2f-0f4e8f7d1b21',
        type: 'info',
        title: 'Your case status was updated',
        message: 'Your case is now under review.',
        read: false,
        createdAt: '2026-03-04T15:00:00.000Z',
        actionUrl: '/dashboard/claims/42',
        actionLabel: 'View case',
      },
    ]);
    expect(inbox.unreadCount).toBe(7);
    expect(inbox.total).toBe(12);
  });

  it('reads an empty inbox as empty, with the zeros the route sent', () => {
    expect(inboxFrom(body({ notifications: [], unreadCount: 0, pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } }))).toEqual({
      notifications: [],
      unreadCount: 0,
      total: 0,
    });
  });

  it.each([
    ['a body with no data', { success: true }],
    ['a bare array', { success: true, data: [row()] }],
    ['no notifications', body({ notifications: undefined })],
    ['notifications that are not a list', body({ notifications: row() })],
    ['no unread count', body({ unreadCount: undefined })],
    ['an unread count that is not a number', body({ unreadCount: '7' })],
    ['a negative unread count', body({ unreadCount: -1 })],
    ['a fractional unread count', body({ unreadCount: 1.5 })],
    ['no pagination', body({ pagination: undefined })],
    ['no total', body({ pagination: { page: 1, limit: 100, totalPages: 1 } })],
    ['a row that is not a record', body({ notifications: ['x'] })],
  ])('refuses %s, which an empty inbox or a count of zero would hide', (_what, answer) => {
    expect(() => inboxFrom(answer)).toThrow(ApiShapeError);
  });
});

describe('notificationFrom', () => {
  it('leaves a link or a label the row does not hold as none', () => {
    expect(notificationFrom(row({ actionUrl: null, actionLabel: null }))).toMatchObject({ actionUrl: null, actionLabel: null });
    expect(notificationFrom(row({ actionUrl: '', actionLabel: undefined }))).toMatchObject({ actionUrl: null, actionLabel: null });
  });

  it('keeps a type the screen does not know as the text it holds', () => {
    expect(notificationFrom(row({ type: 'case_update' })).type).toBe('case_update');
  });

  it('accepts a stored empty message or title as stored text', () => {
    expect(notificationFrom(row({ message: '', title: '' }))).toMatchObject({ message: '', title: '' });
  });

  it.each(['id', 'type', 'createdAt', 'title', 'message', 'read'])('refuses a row with no %s', (field) => {
    expect(() => notificationFrom(row({ [field]: undefined }))).toThrow(ApiShapeError);
  });

  it.each(['true', 1, 0, null])('refuses a read flag that is %j, not a boolean', (read) => {
    expect(() => notificationFrom(row({ read }))).toThrow(ApiShapeError);
  });
});
