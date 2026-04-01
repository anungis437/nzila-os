/**
 * @nzila/platform-contracts — Notification Contracts
 *
 * Cross-app notification interface for the Nzila OS platform.
 */
import { z } from 'zod'

// ── Notification Channel ────────────────────────────────────────────────────

export const notificationChannelValues = [
  'in_app',
  'email',
  'sms',
  'push',
] as const

export type NotificationChannel = (typeof notificationChannelValues)[number]

// ── Notification Priority ───────────────────────────────────────────────────

export const notificationPriorityValues = ['low', 'normal', 'high', 'urgent'] as const
export type NotificationPriority = (typeof notificationPriorityValues)[number]

// ── Notification ────────────────────────────────────────────────────────────

export const notificationSchema = z.object({
  /** Unique notification ID. */
  id: z.string().uuid(),
  /** Recipient user ID. */
  recipientId: z.string().min(1),
  /** Org scope context. */
  orgId: z.string().optional(),
  /** Source module. */
  moduleId: z.string().optional(),
  /** Notification title. */
  title: z.string().min(1),
  /** Notification body. */
  body: z.string(),
  /** Priority level. */
  priority: z.enum(notificationPriorityValues).default('normal'),
  /** Target channels. */
  channels: z.array(z.enum(notificationChannelValues)).default(['in_app']),
  /** Link to relevant resource. */
  actionUrl: z.string().optional(),
  /** Read status. */
  read: z.boolean().default(false),
  /** ISO-8601 timestamp. */
  createdAt: z.string().datetime(),
  /** When the notification was read. */
  readAt: z.string().datetime().optional(),
  /** Notification category for grouping/filtering. */
  category: z.string().optional(),
  /** Arbitrary metadata. */
  metadata: z.record(z.unknown()).optional(),
})

export type Notification = z.infer<typeof notificationSchema>

// ── Unread Count ────────────────────────────────────────────────────────────

export const unreadCountSchema = z.object({
  total: z.number().int().nonnegative(),
  byModule: z.record(z.number().int().nonnegative()).optional(),
  byPriority: z.record(z.number().int().nonnegative()).optional(),
})

export type UnreadCount = z.infer<typeof unreadCountSchema>
