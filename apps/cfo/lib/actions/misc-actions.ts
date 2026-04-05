/**
 * CFO Server Actions — Documents, Tasks, Alerts, Messages, Workflows, Settings.
 *
 * These cover the remaining sidebar items. Each uses platformDb audit_log
 * as the persistence layer until dedicated tables land.
 */
'use server'

import { auth } from '@nzila/platform-auth/entra/server'
import { requirePermission } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

/* ─── Documents ─── */

export interface Document {
  id: string
  name: string
  type: 'invoice' | 'receipt' | 'contract' | 'report' | 'statement' | 'other'
  orgId: string | null
  uploadedBy: string
  uploadedAt: Date
  size: number | null
  url: string | null
}

export async function listDocuments(opts?: {
  page?: number
  pageSize?: number
  type?: string
  orgId?: string
}): Promise<{ documents: Document[]; total: number }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('documents:view')

  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 25
  const offset = (page - 1) * pageSize

  try {
    const rows = (await platformDb.execute(
      sql`SELECT id, metadata->>'name' as name, metadata->>'type' as type,
        org_id as "orgId", actor_id as "uploadedBy",
        created_at as "uploadedAt", (metadata->>'size')::int as size,
        metadata->>'url' as url
      FROM audit_log WHERE action = 'document.uploaded'
      ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
    )) as unknown as { rows: Document[] }
    const [cnt] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM audit_log WHERE action = 'document.uploaded'`,
    )) as unknown as [{ total: number }]
    return { documents: rows.rows ?? [], total: Number(cnt?.total ?? 0) }
  } catch (error) {
    logger.error('listDocuments failed', { error })
    return { documents: [], total: 0 }
  }
}

export async function uploadDocument(data: {
  name: string
  type: Document['type']
  orgId?: string
  size?: number
  url?: string
}): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('documents:upload')
  try {
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('document.uploaded', ${userId}, 'document', ${data.orgId ?? 'platform'},
        ${JSON.stringify(data)}::jsonb)`,
    )
    revalidatePath('/dashboard/documents')
    return { success: true }
  } catch (error) {
    logger.error('uploadDocument failed', { error })
    return { success: false }
  }
}

/* ─── Tasks ─── */

export interface Task {
  id: string
  title: string
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assignedTo: string | null
  dueDate: Date | null
  createdAt: Date
  orgId: string | null
}

export async function listTasks(opts?: {
  status?: string
  priority?: string
  page?: number
}): Promise<{ tasks: Task[]; total: number }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('tasks:view')
  const page = opts?.page ?? 1
  const offset = (page - 1) * 25
  try {
    const result = (await platformDb.execute(
      sql`SELECT id, metadata->>'title' as title, metadata->>'status' as status,
        metadata->>'priority' as priority, metadata->>'assignedTo' as "assignedTo",
        (metadata->>'dueDate')::timestamptz as "dueDate",
        created_at as "createdAt", org_id as "orgId"
      FROM audit_log WHERE action = 'task.created' OR action = 'task.updated'
      ORDER BY created_at DESC LIMIT 25 OFFSET ${offset}`,
    )) as unknown as { rows: Task[] }
    const [cnt] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM audit_log WHERE action LIKE 'task.%'`,
    )) as unknown as [{ total: number }]
    return { tasks: result.rows ?? [], total: Number(cnt?.total ?? 0) }
  } catch (error) {
    logger.error('listTasks failed', { error })
    return { tasks: [], total: 0 }
  }
}

export async function createTask(data: {
  title: string
  priority: Task['priority']
  assignedTo?: string
  dueDate?: string
  orgId?: string
}): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('tasks:create')
  try {
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('task.created', ${userId}, 'task', ${data.orgId ?? 'platform'},
        ${JSON.stringify({ ...data, status: 'pending' })}::jsonb)`,
    )
    revalidatePath('/dashboard/tasks')
    return { success: true }
  } catch (error) {
    logger.error('createTask failed', { error })
    return { success: false }
  }
}

export async function updateTaskStatus(
  taskId: string,
  status: Task['status'],
): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('tasks:complete')
  try {
    await platformDb.execute(
      sql`UPDATE audit_log SET metadata = metadata || ${JSON.stringify({ status })}::jsonb
      WHERE id = ${taskId} AND action = 'task.created'`,
    )
    revalidatePath('/dashboard/tasks')
    return { success: true }
  } catch (error) {
    logger.error('updateTaskStatus failed', { error })
    return { success: false }
  }
}

/* ─── Alerts ─── */

export interface Alert {
  id: string
  title: string
  severity: 'info' | 'warning' | 'critical'
  source: string
  read: boolean
  acknowledged: boolean
  createdAt: Date
}

export async function listAlerts(): Promise<Alert[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('alerts:view')
  try {
    const result = (await platformDb.execute(
      sql`SELECT id, metadata->>'title' as title, metadata->>'severity' as severity,
        metadata->>'source' as source,
        COALESCE((metadata->>'read')::boolean, false) as read,
        COALESCE((metadata->>'acknowledged')::boolean, false) as acknowledged,
        created_at as "createdAt"
      FROM audit_log WHERE action = 'alert.raised'
      ORDER BY created_at DESC LIMIT 50`,
    )) as unknown as { rows: Alert[] }
    return result.rows ?? []
  } catch (error) {
    logger.error('listAlerts failed', { error })
    return []
  }
}

export async function acknowledgeAlert(alertId: string): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('alerts:view')
  try {
    await platformDb.execute(
      sql`UPDATE audit_log SET metadata = metadata || '{"acknowledged": true}'::jsonb
      WHERE id = ${alertId} AND action = 'alert.raised'`,
    )
    revalidatePath('/dashboard/alerts')
    return { success: true }
  } catch (error) {
    logger.error('acknowledgeAlert failed', { error })
    return { success: false }
  }
}

/* ─── Messages ─── */

export interface Message {
  id: string
  from: string
  subject: string
  preview: string
  read: boolean
  createdAt: Date
}

export async function listMessages(): Promise<Message[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('messages:view')
  try {
    const result = (await platformDb.execute(
      sql`SELECT id, metadata->>'from' as "from", metadata->>'subject' as subject,
        metadata->>'preview' as preview,
        COALESCE((metadata->>'read')::boolean, false) as read,
        created_at as "createdAt"
      FROM audit_log WHERE action IN ('message.received', 'message.sent')
      ORDER BY created_at DESC LIMIT 50`,
    )) as unknown as { rows: Message[] }
    return result.rows ?? []
  } catch (error) {
    logger.error('listMessages failed', { error })
    return []
  }
}

export async function sendMessage(data: {
  to: string
  subject: string
  body: string
}): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('messages:send')
  try {
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('message.sent', ${userId}, 'message', 'platform',
        ${JSON.stringify({ from: userId, subject: data.subject, preview: data.body.slice(0, 120), to: data.to, body: data.body, read: true })}::jsonb)`,
    )
    revalidatePath('/dashboard/messages')
    return { success: true }
  } catch (error) {
    logger.error('sendMessage failed', { error })
    return { success: false }
  }
}

/* ─── Workflows ─── */

export interface Workflow {
  id: string
  name: string
  status: 'active' | 'paused' | 'completed' | 'failed'
  trigger: string
  lastRun: Date | null
  runCount: number
}

export async function listWorkflows(): Promise<Workflow[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('workflows:view')
  try {
    const result = (await platformDb.execute(
      sql`SELECT id, metadata->>'name' as name, metadata->>'status' as status,
        metadata->>'trigger' as trigger,
        (metadata->>'lastRun')::timestamptz as "lastRun",
        COALESCE((metadata->>'runCount')::int, 0) as "runCount"
      FROM audit_log WHERE action = 'workflow.registered'
      ORDER BY created_at DESC LIMIT 50`,
    )) as unknown as { rows: Workflow[] }
    return result.rows ?? []
  } catch (error) {
    logger.error('listWorkflows failed', { error })
    return []
  }
}

/* ─── Settings ─── */

export interface CFOSettings {
  currency: string
  fiscalYearStart: number
  timezone: string
  autoReconcile: boolean
  aiAdvisoryEnabled: boolean
  reportSchedule: 'daily' | 'weekly' | 'monthly' | 'on-demand'
}

const DEFAULT_SETTINGS: CFOSettings = {
  currency: 'CAD',
  fiscalYearStart: 1,
  timezone: 'America/Toronto',
  autoReconcile: false,
  aiAdvisoryEnabled: true,
  reportSchedule: 'monthly',
}

export async function getSettings(): Promise<CFOSettings> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('settings:view')
  try {
    const [row] = (await platformDb.execute(
      sql`SELECT metadata FROM audit_log
      WHERE action = 'settings.updated' AND org_id = 'cfo-platform'
      ORDER BY created_at DESC LIMIT 1`,
    )) as unknown as [{ metadata: Partial<CFOSettings> } | undefined]
    if (!row) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...row.metadata }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function updateSettings(
  settings: Partial<CFOSettings>,
): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('settings:manage')
  try {
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('settings.updated', ${userId}, 'settings', 'cfo-platform',
        ${JSON.stringify(settings)}::jsonb)`,
    )
    revalidatePath('/dashboard/settings')
    return { success: true }
  } catch (error) {
    logger.error('updateSettings failed', { error })
    return { success: false }
  }
}
