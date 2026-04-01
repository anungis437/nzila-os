import { z } from 'zod';
import {
  notificationSchema,
  type Notification,
  type NotificationChannel,
  type NotificationPriority,
} from '@nzila/platform-contracts/notification';

// ---------------------------------------------------------------------------
// Notification dispatch request
// ---------------------------------------------------------------------------

export const sendNotificationInputSchema = z.object({
  orgId: z.string().min(1),
  recipientUserId: z.string().min(1),
  title: z.string().min(1).max(256),
  body: z.string().max(4096),
  channels: z.array(z.enum(['in_app', 'email', 'sms', 'push'])).min(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  category: z.string().optional(),
  actionUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type SendNotificationInput = z.infer<typeof sendNotificationInputSchema>;

// ---------------------------------------------------------------------------
// Notification service interface
// ---------------------------------------------------------------------------

export interface NotificationService {
  /** Send a notification through the specified channels. */
  send(input: SendNotificationInput): Promise<Notification>;

  /** List unread notifications for a user within an org scope. */
  listUnread(orgId: string, userId: string): Promise<Notification[]>;

  /** Mark one notification as read. */
  markRead(orgId: string, notificationId: string): Promise<void>;

  /** Mark all notifications as read for a user within an org scope. */
  markAllRead(orgId: string, userId: string): Promise<void>;

  /** Get unread count per channel. */
  getUnreadCount(
    orgId: string,
    userId: string,
  ): Promise<{ total: number; byChannel: Record<NotificationChannel, number> }>;
}

// ---------------------------------------------------------------------------
// In-memory implementation (dev / testing)
// ---------------------------------------------------------------------------

export function createInMemoryNotificationService(): NotificationService {
  const store: Notification[] = [];

  return {
    async send(input) {
      const parsed = sendNotificationInputSchema.parse(input);
      const notification: Notification = {
        id: crypto.randomUUID(),
        orgId: parsed.orgId,
        recipientUserId: parsed.recipientUserId,
        title: parsed.title,
        body: parsed.body,
        channels: parsed.channels,
        priority: parsed.priority,
        category: parsed.category,
        actionUrl: parsed.actionUrl,
        metadata: parsed.metadata ?? {},
        read: false,
        createdAt: new Date().toISOString(),
      };
      store.push(notification);
      return notification;
    },

    async listUnread(orgId, userId) {
      return store.filter(
        (n) => n.orgId === orgId && n.recipientUserId === userId && !n.read,
      );
    },

    async markRead(orgId, notificationId) {
      const n = store.find((n) => n.orgId === orgId && n.id === notificationId);
      if (n) n.read = true;
    },

    async markAllRead(orgId, userId) {
      for (const n of store) {
        if (n.orgId === orgId && n.recipientUserId === userId) n.read = true;
      }
    },

    async getUnreadCount(orgId, userId) {
      const unread = store.filter(
        (n) => n.orgId === orgId && n.recipientUserId === userId && !n.read,
      );
      const byChannel: Record<NotificationChannel, number> = {
        in_app: 0,
        email: 0,
        sms: 0,
        push: 0,
      };
      for (const n of unread) {
        for (const ch of n.channels) byChannel[ch]++;
      }
      return { total: unread.length, byChannel };
    },
  };
}
