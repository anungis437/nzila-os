import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { CfoScopeError, assertCfoContextPermission, type CfoActionContext } from '@/lib/resolve-org'
import {
  createCfoRecord,
  getCfoRecord,
  listCfoRecords,
  changeCfoRecordMetadata,
  safeCfoNotificationUrl,
  type CfoRecord,
} from './cfo-records'
const documentType = z.enum(['invoice', 'receipt', 'contract', 'report', 'statement', 'other'])
const taskStatus = z.enum(['pending', 'in-progress', 'completed', 'cancelled']),
  priority = z.enum(['low', 'medium', 'high', 'urgent'])
export interface Document {
  id: string
  name: string
  type: z.infer<typeof documentType>
  orgId: string | null
  uploadedBy: string
  uploadedAt: Date
  size: number | null
  url: string | null
}
export interface Task {
  id: string
  title: string
  status: z.infer<typeof taskStatus>
  priority: z.infer<typeof priority>
  assignedTo: string | null
  dueDate: Date | null
  createdAt: Date
  orgId: string | null
}
export interface Alert {
  id: string
  title: string
  severity: 'info' | 'warning' | 'critical'
  source: string
  read: boolean
  acknowledged: boolean
  createdAt: Date
}
export interface Message {
  id: string
  from: string
  subject: string
  preview: string
  read: boolean
  createdAt: Date
}
export interface CFOSettings {
  currency: string
  fiscalYearStart: number
  timezone: string
  autoReconcile: boolean
  aiAdvisoryEnabled: boolean
  reportSchedule: 'daily' | 'weekly' | 'monthly' | 'on-demand'
}
const settings = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    fiscalYearStart: z.number().int().min(1).max(12),
    timezone: z
      .string()
      .min(1)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value })
          return true
        } catch {
          return false
        }
      }),
    autoReconcile: z.boolean(),
    aiAdvisoryEnabled: z.boolean(),
    reportSchedule: z.enum(['daily', 'weekly', 'monthly', 'on-demand']),
  })
  .strict()
const defaults: CFOSettings = {
  currency: 'CAD',
  fiscalYearStart: 1,
  timezone: 'America/Toronto',
  autoReconcile: false,
  aiAdvisoryEnabled: true,
  reportSchedule: 'monthly',
}
const safeString = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)
function document(row: CfoRecord): Document {
  const m = z
    .object({
      name: z.string(),
      type: documentType,
      size: z.number().int().nonnegative().optional(),
      url: z.string().optional(),
    })
    .parse(row.metadata)
  return {
    id: row.id,
    name: m.name,
    type: m.type,
    orgId: row.organizationId,
    uploadedBy: row.actorId,
    uploadedAt: row.createdAt,
    size: m.size ?? null,
    url: safeCfoNotificationUrl(m.url),
  }
}
export async function documents(
  context: CfoActionContext,
  options?: { page?: number; pageSize?: number; type?: string; orgId?: string },
) {
  const opts = z
    .object({
      page: z.number().int().positive().optional(),
      pageSize: z.number().int().min(1).max(500).optional(),
      type: documentType.optional(),
      orgId: z.string().uuid().optional(),
    })
    .strict()
    .parse(options ?? {})
  const rows = (await listCfoRecords(context, 'document.uploaded'))
    .map(document)
    .filter((r) => (!opts.type || r.type === opts.type) && (!opts.orgId || r.orgId === opts.orgId))
  const offset = ((opts.page ?? 1) - 1) * (opts.pageSize ?? 25)
  return { documents: rows.slice(offset, offset + (opts.pageSize ?? 25)), total: rows.length }
}
export async function recordUploadedDocument(
  context: CfoActionContext,
  data: {
    name: string
    type: Document['type']
    size: number
    url: string
    blobPath: string
    sha256: string
  },
) {
  assertCfoContextPermission(context, 'documents:upload')
  const value = z
    .object({
      name: z.string().trim().min(1),
      type: documentType,
      size: z.number().int().nonnegative(),
      url: z.string().url(),
      blobPath: z.string().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict()
    .parse(data)
  return createCfoRecord(context, { action: 'document.uploaded', metadata: value })
}
export async function annotateDocument(
  context: CfoActionContext,
  data: {
    name: string
    type: Document['type']
    orgId?: string
    size?: number
    url?: string
    uploadId?: string
  },
) {
  const value = z
    .object({
      name: z.string().trim().min(1),
      type: documentType,
      orgId: z.string().uuid().optional(),
      size: z.number().int().nonnegative().optional(),
      url: z.string().optional(),
      uploadId: z.string().uuid(),
    })
    .strict()
    .parse(data)
  const row = await getCfoRecord(context, value.uploadId, ['document.uploaded'], {
    lock: 'update',
    manage: true,
  })
  // An arbitrary URL/size from a caller can never mint an upload or transfer it.
  if (
    !row ||
    row.actorId !== context.userId ||
    !row.organizationId ||
    (value.orgId && value.orgId !== row.organizationId) ||
    (value.size !== undefined && value.size !== row.metadata.size) ||
    (value.url !== undefined && value.url !== row.metadata.url)
  )
    throw new CfoScopeError()
  return changeCfoRecordMetadata(
    context,
    row,
    { name: value.name, type: value.type },
    'document.annotated',
  )
}
function task(row: CfoRecord): Task {
  const m = z
    .object({
      title: z.string(),
      status: taskStatus,
      priority,
      assignedTo: z.string().optional(),
      dueDate: z.coerce.date().optional(),
    })
    .parse(row.metadata)
  return {
    id: row.id,
    title: m.title,
    status: m.status,
    priority: m.priority,
    assignedTo: m.assignedTo ?? null,
    dueDate: m.dueDate ?? null,
    createdAt: row.createdAt,
    orgId: row.organizationId,
  }
}
export async function tasks(
  context: CfoActionContext,
  options?: { status?: string; priority?: string; page?: number },
) {
  const opts = z
      .object({
        status: taskStatus.optional(),
        priority: priority.optional(),
        page: z.number().int().positive().optional(),
      })
      .strict()
      .parse(options ?? {}),
    rows = (await listCfoRecords(context, 'task.created'))
      .map(task)
      .filter(
        (r) =>
          (!opts.status || r.status === opts.status) &&
          (!opts.priority || r.priority === opts.priority),
      )
  return {
    tasks: rows.slice(((opts.page ?? 1) - 1) * 25, (opts.page ?? 1) * 25),
    total: rows.length,
  }
}
export async function newTask(
  context: CfoActionContext,
  data: {
    title: string
    priority: Task['priority']
    assignedTo?: string
    dueDate?: string
    orgId?: string
  },
) {
  const { orgId: _selector, ...value } = z
    .object({
      title: z.string().trim().min(1),
      priority,
      assignedTo: z.string().min(1).optional(),
      dueDate: z
        .string()
        .refine((v) => Number.isFinite(Date.parse(v)))
        .optional(),
      orgId: z.string().uuid().optional(),
    })
    .strict()
    .parse(data)
  await createCfoRecord(context, {
    action: 'task.created',
    metadata: { ...value, status: 'pending' },
  })
  return { success: true }
}
export async function changeTask(context: CfoActionContext, id: string, status: Task['status']) {
  const value = taskStatus.parse(status),
    row = await getCfoRecord(context, id, ['task.created'], { lock: 'update', manage: true })
  if (!row) return { success: false }
  return changeCfoRecordMetadata(context, row, { status: value }, 'task.status_changed')
}
export async function alerts(context: CfoActionContext): Promise<Alert[]> {
  return (await listCfoRecords(context, 'alert.raised')).slice(0, 50).map((row) => {
    const m = row.metadata
    return {
      id: row.id,
      title: safeString(m.title),
      severity: z.enum(['info', 'warning', 'critical']).parse(m.severity),
      source: safeString(m.source),
      read: m.read === true,
      acknowledged: m.acknowledged === true,
      createdAt: row.createdAt,
    }
  })
}
export async function acknowledge(context: CfoActionContext, id: string) {
  const row = await getCfoRecord(context, id, ['alert.raised'], { lock: 'update', manage: true })
  if (!row) return { success: false }
  return changeCfoRecordMetadata(context, row, { acknowledged: true }, 'alert.acknowledged')
}
export async function messages(context: CfoActionContext): Promise<Message[]> {
  const rows = (
    await Promise.all([
      listCfoRecords(context, 'message.sent'),
      listCfoRecords(context, 'message.received'),
    ])
  )
    .flat()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
  return rows
    .slice(0, 50)
    .map((row) => ({
      id: row.id,
      from: row.actorId,
      subject: safeString(row.metadata.subject),
      preview: safeString(row.metadata.preview),
      read: row.actorId === context.userId || row.metadata.read === true,
      createdAt: row.createdAt,
    }))
}
export async function message(
  context: CfoActionContext,
  data: { to: string; subject: string; body: string; orgId?: string },
) {
  const { orgId: _selector, ...value } = z
    .object({
      to: z.string().min(1),
      subject: z.string().trim().min(1),
      body: z.string().min(1),
      orgId: z.string().uuid().optional(),
    })
    .strict()
    .parse(data)
  await createCfoRecord(context, {
    action: 'message.sent',
    metadata: { ...value, from: context.userId, preview: value.body.slice(0, 120), read: false },
  })
  return { success: true }
}
function projectSettings(metadata: Readonly<Record<string, unknown>>): CFOSettings {
  const selected: Record<string, unknown> = {}
  for (const key of Object.keys(defaults))
    if (Object.hasOwn(metadata, key)) selected[key] = metadata[key]
  return settings.parse({ ...defaults, ...selected })
}
export async function workspaceSettings(context: CfoActionContext): Promise<CFOSettings> {
  const rows = await listCfoRecords(context, 'settings.updated'),
    latest = rows.find(
      (row) => row.organizationId === context.organizationId && context.organizationId !== null,
    )
  return latest ? projectSettings(latest.metadata) : { ...defaults }
}
export async function changeWorkspaceSettings(
  context: CfoActionContext,
  data: Partial<CFOSettings>,
) {
  assertCfoContextPermission(context, 'settings:manage')
  if (context.purpose !== 'organization') throw new CfoScopeError()
  const patch = settings.partial().parse(data)
  await context.db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`cfo.settings:${context.organizationId}`}))`,
  )
  const current = await workspaceSettings(context)
  await createCfoRecord(context, { action: 'settings.updated', metadata: { ...current, ...patch } })
  return { success: true }
}
