/** Exact canonical recipients; unbound historical UUID rows remain unserved. */
'use server'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { resolveOrgContext, ZongaScopeError, isZongaId } from '@/lib/resolve-org'
import { zongaRows } from '@/queries/action-context'
import {
  notifyModerationResolution,
  type NotificationRequest,
} from '@/lib/services/moderation-notifications'
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
export async function listNotifications(opts?: { unreadOnly?: boolean }): Promise<Notification[]> {
  return resolveOrgContext('personal', async (context) =>
    zongaRows<Notification>(
      await context.db.execute(
        sql`SELECT id,recipient_user_id AS "userId",type,title,body,link,read,created_at AS "createdAt" FROM public.zonga_notifications WHERE recipient_user_id=${context.actorId} AND user_id IS NULL ${opts?.unreadOnly ? sql`AND read=false` : sql``} ORDER BY created_at DESC LIMIT 100`,
      ),
    ),
  )
}
export async function getUnreadCount(): Promise<number> {
  return resolveOrgContext('personal', async (context) => {
    const [row] = zongaRows<{ total: number }>(
      await context.db.execute(
        sql`SELECT count(*) AS total FROM public.zonga_notifications WHERE recipient_user_id=${context.actorId} AND user_id IS NULL AND read=false`,
      ),
    )
    return Number(row?.total ?? 0)
  })
}
export async function markAsRead(notificationId: string): Promise<{ success: boolean }> {
  const result = await resolveOrgContext('personal', async (context) => {
    if (!isZongaId(notificationId)) throw new ZongaScopeError()
    const [row] = zongaRows<{ id: string }>(
      await context.db.execute(
        sql`UPDATE public.zonga_notifications SET read=true WHERE id=${notificationId}::uuid AND recipient_user_id=${context.actorId} AND user_id IS NULL RETURNING id`,
      ),
    )
    return { success: !!row }
  })
  // Invalidate only after the scoped transaction has committed a real change.
  if (result.success) revalidatePath('/dashboard/notifications')
  return result
}
export async function markAllRead(): Promise<{ success: boolean }> {
  const result = await resolveOrgContext('personal', async (context) => {
    await context.db.execute(
      sql`UPDATE public.zonga_notifications SET read=true WHERE recipient_user_id=${context.actorId} AND user_id IS NULL AND read=false`,
    )
    return { success: true }
  })
  revalidatePath('/dashboard/notifications')
  return result
}
export async function createNotification(
  data: NotificationRequest,
): Promise<{ success: boolean; notificationId?: string }> {
  return resolveOrgContext('organization', { organizationId: data?.orgId }, async (context) => {
    if (!data.caseId) throw new ZongaScopeError('A verified resolved moderation source is required')
    return notifyModerationResolution(context, data.caseId, data)
  })
}
