/**
 * Zonga Server Actions — Notifications.
 *
 * In-app notification CRUD: list, mark-read, mark-all-read, create.
 * Reads/writes zonga_notifications domain table directly.
 */
'use server'

import { auth } from '@nzila/platform-auth/entra/server'
import { resolveListenerContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'

/* ─── Types ─── */

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body?: string
  link?: string
  read: boolean
  createdAt?: Date
}

/* ─── List ─── */

export async function listNotifications(opts?: {
  unreadOnly?: boolean
}): Promise<Notification[]> {
  await auth()
  const ctx = await resolveListenerContext()

  try {
    const readFilter = opts?.unreadOnly ? sql` AND read = false` : sql``
    const orgFilter = ctx.orgId ? sql` AND org_id = ${ctx.orgId}` : sql``

    const rows = (await platformDb.execute(
      sql`SELECT
        id,
        user_id as "userId",
        type,
        title,
        body,
        link,
        read,
        created_at as "createdAt"
      FROM zonga_notifications
      WHERE user_id = ${ctx.actorId}
      ${orgFilter}
      ${readFilter}
      ORDER BY created_at DESC
      LIMIT 100`,
    )) as unknown as Notification[]

    return rows ?? []
  } catch (error) {
    logger.error('listNotifications failed', { error })
    return []
  }
}

/* ─── Unread count ─── */

export async function getUnreadCount(): Promise<number> {
  const ctx = await resolveListenerContext()

  try {
    const orgFilter = ctx.orgId ? sql` AND org_id = ${ctx.orgId}` : sql``

    const [result] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_notifications
      WHERE user_id = ${ctx.actorId}${orgFilter} AND read = false`,
    )) as unknown as [{ total: number }]

    return Number(result?.total ?? 0)
  } catch (error) {
    logger.error('getUnreadCount failed', { error })
    return 0
  }
}

/* ─── Mark single as read ─── */

export async function markAsRead(notificationId: string): Promise<{ success: boolean }> {
  const ctx = await resolveListenerContext()

  try {
    const orgFilter = ctx.orgId ? sql` AND org_id = ${ctx.orgId}` : sql``

    await platformDb.execute(
      sql`UPDATE zonga_notifications SET read = true
      WHERE id = ${notificationId} AND user_id = ${ctx.actorId}${orgFilter}`,
    )

    revalidatePath('/dashboard/notifications')
    return { success: true }
  } catch (error) {
    logger.error('markAsRead failed', { error })
    return { success: false }
  }
}

/* ─── Mark all as read ─── */

export async function markAllRead(): Promise<{ success: boolean }> {
  const ctx = await resolveListenerContext()

  try {
    const orgFilter = ctx.orgId ? sql` AND org_id = ${ctx.orgId}` : sql``

    await platformDb.execute(
      sql`UPDATE zonga_notifications SET read = true
      WHERE user_id = ${ctx.actorId}${orgFilter} AND read = false`,
    )

    revalidatePath('/dashboard/notifications')
    return { success: true }
  } catch (error) {
    logger.error('markAllRead failed', { error })
    return { success: false }
  }
}

/* ─── Create notification (used internally by other actions) ─── */

export async function createNotification(data: {
  orgId: string
  userId: string
  type: string
  title: string
  body?: string
  link?: string
}): Promise<{ success: boolean; notificationId?: string }> {
  try {
    const [row] = (await platformDb.execute(
      sql`INSERT INTO zonga_notifications (org_id, user_id, type, title, body, link)
      VALUES (${data.orgId}, ${data.userId}, ${data.type}, ${data.title},
        ${data.body ?? null}, ${data.link ?? null})
      RETURNING id`,
    )) as unknown as [{ id: string }]

    return { success: true, notificationId: row?.id }
  } catch (error) {
    logger.error('createNotification failed', { error })
    return { success: false }
  }
}
