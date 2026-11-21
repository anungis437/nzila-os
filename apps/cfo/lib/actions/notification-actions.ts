'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { CfoScopeError, resolveOrgContext } from '@/lib/resolve-org'
import { logger } from '@/lib/logger'
import {
  createCfoRecord,
  listCfoNotifications,
  markCfoNotification,
  markAllCfoNotifications,
  safeCfoNotificationUrl,
  type CfoNotification,
} from '@/lib/services/cfo-records'
export type Notification = CfoNotification

const optionsSchema = z
  .object({ unreadOnly: z.boolean().optional(), page: z.number().int().positive().optional() })
  .strict()
const notificationInput = z
  .object({
    type: z.enum([
      'workflow_assignment',
      'alert_triggered',
      'report_ready',
      'task_overdue',
      'system',
      'security_event',
    ]),
    title: z.string().min(1),
    message: z.string().min(1),
    priority: z.enum(['urgent', 'high', 'normal', 'low']).default('normal'),
    recipientId: z
      .string()
      .min(1)
      .max(255)
      .refine((value) => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value)),
    organizationId: z.string().optional(),
    actionUrl: z
      .string()
      .optional()
      .refine((value) => !value || safeCfoNotificationUrl(value) !== null),
  })
  .strict()
function refresh() {
  try {
    revalidatePath('/dashboard/notifications')
  } catch {
    logger.warn('Notification cache invalidation unavailable after commit')
  }
}
function fail(error: unknown, operation: string) {
  if (error instanceof CfoScopeError) throw error
  logger.error(`Notification ${operation} failed`, {
    errorName: error instanceof Error ? error.name : 'unknown',
  })
  return { success: false }
}
export async function listNotifications(options?: {
  unreadOnly?: boolean
  page?: number
}): Promise<{ notifications: Notification[]; unreadCount: number }> {
  return resolveOrgContext('resource', { permission: 'notifications:view' }, (context) =>
    listCfoNotifications(context, optionsSchema.parse(options ?? {})),
  )
}
export async function getUnreadCount(): Promise<number> {
  return resolveOrgContext(
    'resource',
    { permission: 'notifications:view' },
    async (context) => (await listCfoNotifications(context)).unreadCount,
  )
}
export async function markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
  try {
    const result = await resolveOrgContext(
      'resource',
      { permission: 'notifications:view' },
      (context) => markCfoNotification(context, notificationId, 'read'),
    )
    refresh()
    return result
  } catch (error) {
    return fail(error, 'read')
  }
}
export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
  try {
    const result = await resolveOrgContext(
      'resource',
      { permission: 'notifications:view' },
      markAllCfoNotifications,
    )
    refresh()
    return result
  } catch (error) {
    return fail(error, 'read-all')
  }
}
export async function createNotification(data: {
  type: Notification['type']
  title: string
  message: string
  priority?: Notification['priority']
  recipientId?: string
  organizationId?: string
  actionUrl?: string
}): Promise<{ success: boolean }> {
  try {
    const result = await resolveOrgContext(
      'organization',
      { permission: 'notifications:manage', organizationId: data?.organizationId },
      async (context) => {
        const { organizationId: _selector, ...metadata } = notificationInput.parse(data)
        await createCfoRecord(context, { action: 'notification.created', metadata })
        return { success: true }
      },
    )
    refresh()
    return result
  } catch (error) {
    return fail(error, 'create')
  }
}
export async function deleteNotification(notificationId: string): Promise<{ success: boolean }> {
  try {
    const result = await resolveOrgContext(
      'resource',
      { permission: 'notifications:manage' },
      (context) => markCfoNotification(context, notificationId, 'deleted'),
    )
    refresh()
    return result
  } catch (error) {
    return fail(error, 'delete')
  }
}
