/**
 * CFO Server Actions — Notification Center.
 *
 * In-app notifications with read/unread state, mark-read/delete actions,
 * and notification creation for system events.
 */
'use server'

import { auth } from '@nzila/platform-auth/entra/server'
import { requirePermission } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

/* ─── Types ─── */

export interface Notification {
  id: string
  type: 'workflow_assignment' | 'alert_triggered' | 'report_ready' | 'task_overdue' | 'system' | 'security_event'
  title: string
  message: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  read: boolean
  actionUrl: string | null
  createdAt: Date
}

/* ─── Queries ─── */

export async function listNotifications(opts?: {
  unreadOnly?: boolean
  page?: number
}): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('notifications:view')

  const page = opts?.page ?? 1
  const offset = (page - 1) * 50

  try {
    // Get read notification IDs
    const readRows = (await platformDb.execute(
      sql`SELECT org_id as "notificationId"
      FROM audit_log WHERE action = 'notification.read' AND actor_id = ${userId}`,
    )) as unknown as { rows: { notificationId: string }[] }

    const readAllRows = (await platformDb.execute(
      sql`SELECT MAX(created_at) as "readAllAt"
      FROM audit_log WHERE action = 'notification.read_all' AND actor_id = ${userId}`,
    )) as unknown as { rows: { readAllAt: Date | null }[] }

    const readIds = new Set((readRows.rows ?? []).map((r) => r.notificationId))
    const readAllAt = readAllRows.rows?.[0]?.readAllAt

    const unreadFilter = opts?.unreadOnly ? sql`AND id NOT IN (
      SELECT org_id FROM audit_log WHERE action = 'notification.read' AND actor_id = ${userId}
    )` : sql``

    const rows = (await platformDb.execute(
      sql`SELECT id, metadata->>'type' as type, metadata->>'title' as title,
        metadata->>'message' as message, metadata->>'priority' as priority,
        metadata->>'actionUrl' as "actionUrl",
        created_at as "createdAt"
      FROM audit_log WHERE action = 'notification.created'
        AND (metadata->>'recipientId' = ${userId} OR metadata->>'recipientId' IS NULL)
        ${unreadFilter}
      ORDER BY created_at DESC LIMIT 50 OFFSET ${offset}`,
    )) as unknown as { rows: (Omit<Notification, 'read'>)[] }

    const notifications: Notification[] = (rows.rows ?? []).map((n) => ({
      ...n,
      read: readIds.has(n.id) || (readAllAt != null && new Date(n.createdAt) <= new Date(readAllAt)),
    }))

    const unreadCount = notifications.filter((n) => !n.read).length

    return { notifications, unreadCount }
  } catch (error) {
    logger.error('listNotifications failed', { error })
    return { notifications: [], unreadCount: 0 }
  }
}

export async function getUnreadCount(): Promise<number> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('notifications:view')

  try {
    const { unreadCount } = await listNotifications({ unreadOnly: false })
    return unreadCount
  } catch (error) {
    logger.error('getUnreadCount failed', { error })
    return 0
  }
}

export async function markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('notifications:view')

  try {
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('notification.read', ${userId}, 'notification', ${notificationId},
        ${JSON.stringify({ readBy: userId })}::jsonb)`,
    )
    revalidatePath('/dashboard/notifications')
    return { success: true }
  } catch (error) {
    logger.error('markNotificationRead failed', { error })
    return { success: false }
  }
}

export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('notifications:view')

  try {
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('notification.read_all', ${userId}, 'notification', 'all',
        ${JSON.stringify({ readBy: userId })}::jsonb)`,
    )
    revalidatePath('/dashboard/notifications')
    return { success: true }
  } catch (error) {
    logger.error('markAllNotificationsRead failed', { error })
    return { success: false }
  }
}

export async function createNotification(data: {
  type: Notification['type']
  title: string
  message: string
  priority?: Notification['priority']
  recipientId?: string
  actionUrl?: string
}): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('notifications:manage')

  try {
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('notification.created', ${userId}, 'notification', 'platform',
        ${JSON.stringify({ ...data, priority: data.priority ?? 'normal' })}::jsonb)`,
    )
    revalidatePath('/dashboard/notifications')
    return { success: true }
  } catch (error) {
    logger.error('createNotification failed', { error })
    return { success: false }
  }
}

export async function deleteNotification(notificationId: string): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('notifications:manage')

  try {
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('notification.deleted', ${userId}, 'notification', ${notificationId},
        ${JSON.stringify({ deletedBy: userId })}::jsonb)`,
    )
    revalidatePath('/dashboard/notifications')
    return { success: true }
  } catch (error) {
    logger.error('deleteNotification failed', { error })
    return { success: false }
  }
}
