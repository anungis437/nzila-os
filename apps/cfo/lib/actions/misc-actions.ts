/** Existing workspace records with live actor/tenant/parent authority. */
'use server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { CfoScopeError, resolveOrgContext } from '@/lib/resolve-org'
import {
  documents,
  annotateDocument,
  tasks,
  newTask,
  changeTask,
  alerts,
  acknowledge,
  messages,
  message,
  workspaceSettings,
  changeWorkspaceSettings,
  type Document,
  type Task,
  type Alert,
  type Message,
  type CFOSettings,
} from '@/lib/services/workspace-records'
import { listWorkflowTemplates } from '@/lib/services/workflows'
export type { Document, Task, Alert, Message, CFOSettings } from '@/lib/services/workspace-records'
/** Log a failed action with the structured logger and rethrow it unchanged.
 * Scope denials are not operational failures and are not logged here. */
function logged<T>(operation: string, run: () => Promise<T>): Promise<T> {
  return run().catch((error: unknown) => {
    if (!(error instanceof CfoScopeError)) logger.error(`Workspace ${operation} failed`, { error })
    throw error
  })
}
/** Invalidate the dashboard view after the mutation's transaction committed. */
function refresh(path: string) {
  try {
    revalidatePath(path)
  } catch {
    logger.warn('Workspace cache invalidation unavailable after commit', { path })
  }
}
async function mutation(
  operation: string,
  path: string,
  run: () => Promise<{ success: boolean }>,
): Promise<{ success: boolean }> {
  const result = await logged(operation, run)
  if (result.success) refresh(path)
  return result
}
export interface Workflow {
  id: string
  name: string
  status: 'active' | 'inactive' | 'paused' | 'completed' | 'failed'
  trigger: string
  lastRun: Date | null
  runCount: number
}
export async function listDocuments(opts?: {
  page?: number
  pageSize?: number
  type?: string
  orgId?: string
}): Promise<{ documents: Document[]; total: number }> {
  return logged('list documents', () =>
    resolveOrgContext('resource', { permission: 'documents:view' }, (context) =>
      documents(context, opts),
    ),
  )
}
export async function uploadDocument(data: {
  name: string
  type: Document['type']
  orgId?: string
  size?: number
  url?: string
  uploadId?: string
}): Promise<{ success: boolean }> {
  return mutation('upload document', '/dashboard/documents', () =>
    resolveOrgContext('resource', { permission: 'documents:upload' }, (context) =>
      annotateDocument(context, data),
    ),
  )
}
export async function listTasks(opts?: {
  status?: string
  priority?: string
  page?: number
}): Promise<{ tasks: Task[]; total: number }> {
  return logged('list tasks', () =>
    resolveOrgContext('resource', { permission: 'tasks:view' }, (context) => tasks(context, opts)),
  )
}
export async function createTask(data: {
  title: string
  priority: Task['priority']
  assignedTo?: string
  dueDate?: string
  orgId?: string
}): Promise<{ success: boolean }> {
  return mutation('create task', '/dashboard/tasks', () =>
    resolveOrgContext(
      'organization',
      { permission: 'tasks:create', organizationId: data?.orgId },
      (context) => newTask(context, data),
    ),
  )
}
export async function updateTaskStatus(
  taskId: string,
  status: Task['status'],
): Promise<{ success: boolean }> {
  return mutation('update task status', '/dashboard/tasks', () =>
    resolveOrgContext('resource', { permission: 'tasks:complete' }, (context) =>
      changeTask(context, taskId, status),
    ),
  )
}
export async function listAlerts(): Promise<Alert[]> {
  return logged('list alerts', () =>
    resolveOrgContext('resource', { permission: 'alerts:view' }, alerts),
  )
}
export async function acknowledgeAlert(alertId: string): Promise<{ success: boolean }> {
  return mutation('acknowledge alert', '/dashboard/alerts', () =>
    resolveOrgContext('resource', { permission: 'alerts:view' }, (context) =>
      acknowledge(context, alertId),
    ),
  )
}
export async function listMessages(): Promise<Message[]> {
  return logged('list messages', () =>
    resolveOrgContext('resource', { permission: 'messages:view' }, messages),
  )
}
export async function sendMessage(data: {
  to: string
  subject: string
  body: string
  orgId?: string
}): Promise<{ success: boolean }> {
  return mutation('send message', '/dashboard/messages', () =>
    resolveOrgContext(
      'organization',
      { permission: 'messages:send', organizationId: data?.orgId },
      (context) => message(context, data),
    ),
  )
}
export async function listWorkflows(): Promise<Workflow[]> {
  return logged('list workflows', () =>
    resolveOrgContext('resource', { permission: 'workflows:view' }, listWorkflowTemplates),
  )
}
export async function getSettings(organizationId?: string): Promise<CFOSettings> {
  return logged('read settings', () =>
    resolveOrgContext(
      'organization',
      { permission: 'settings:view', organizationId },
      workspaceSettings,
    ),
  )
}
export async function updateSettings(
  settings: Partial<CFOSettings>,
  organizationId?: string,
): Promise<{ success: boolean }> {
  return mutation('update settings', '/dashboard/settings', () =>
    resolveOrgContext(
      'organization',
      { permission: 'settings:manage', organizationId },
      (context) => changeWorkspaceSettings(context, settings),
    ),
  )
}
