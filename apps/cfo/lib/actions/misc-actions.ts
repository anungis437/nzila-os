/** Existing workspace records with live actor/tenant/parent authority. */
'use server'
import { resolveOrgContext } from '@/lib/resolve-org'
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
  return resolveOrgContext('resource', { permission: 'documents:view' }, (context) =>
    documents(context, opts),
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
  return resolveOrgContext('resource', { permission: 'documents:upload' }, (context) =>
    annotateDocument(context, data),
  )
}
export async function listTasks(opts?: {
  status?: string
  priority?: string
  page?: number
}): Promise<{ tasks: Task[]; total: number }> {
  return resolveOrgContext('resource', { permission: 'tasks:view' }, (context) =>
    tasks(context, opts),
  )
}
export async function createTask(data: {
  title: string
  priority: Task['priority']
  assignedTo?: string
  dueDate?: string
  orgId?: string
}): Promise<{ success: boolean }> {
  return resolveOrgContext(
    'organization',
    { permission: 'tasks:create', organizationId: data?.orgId },
    (context) => newTask(context, data),
  )
}
export async function updateTaskStatus(
  taskId: string,
  status: Task['status'],
): Promise<{ success: boolean }> {
  return resolveOrgContext('resource', { permission: 'tasks:complete' }, (context) =>
    changeTask(context, taskId, status),
  )
}
export async function listAlerts(): Promise<Alert[]> {
  return resolveOrgContext('resource', { permission: 'alerts:view' }, alerts)
}
export async function acknowledgeAlert(alertId: string): Promise<{ success: boolean }> {
  return resolveOrgContext('resource', { permission: 'alerts:view' }, (context) =>
    acknowledge(context, alertId),
  )
}
export async function listMessages(): Promise<Message[]> {
  return resolveOrgContext('resource', { permission: 'messages:view' }, messages)
}
export async function sendMessage(data: {
  to: string
  subject: string
  body: string
  orgId?: string
}): Promise<{ success: boolean }> {
  return resolveOrgContext(
    'organization',
    { permission: 'messages:send', organizationId: data?.orgId },
    (context) => message(context, data),
  )
}
export async function listWorkflows(): Promise<Workflow[]> {
  return resolveOrgContext('resource', { permission: 'workflows:view' }, listWorkflowTemplates)
}
export async function getSettings(organizationId?: string): Promise<CFOSettings> {
  return resolveOrgContext(
    'organization',
    { permission: 'settings:view', organizationId },
    workspaceSettings,
  )
}
export async function updateSettings(
  settings: Partial<CFOSettings>,
  organizationId?: string,
): Promise<{ success: boolean }> {
  return resolveOrgContext(
    'organization',
    { permission: 'settings:manage', organizationId },
    (context) => changeWorkspaceSettings(context, settings),
  )
}
