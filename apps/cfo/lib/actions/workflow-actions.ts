/** Existing workflow behavior with live source scope and atomic parent/history. */
'use server'
import { revalidatePath } from 'next/cache'
import { CfoScopeError, resolveOrgContext } from '@/lib/resolve-org'
import { logger } from '@/lib/logger'
import {
  createWorkflow,
  readWorkflow,
  startWorkflow,
  readWorkflowInstance,
  listInstances,
  decideWorkflowStep,
  type WorkflowTemplate,
  type WorkflowStep,
  type WorkflowInstance,
} from '@/lib/services/workflows'
export type {
  WorkflowTemplate,
  WorkflowStep,
  WorkflowInstance,
  WorkflowInstanceStep,
} from '@/lib/services/workflows'
function refresh() {
  try {
    revalidatePath('/dashboard/workflows')
  } catch {
    logger.warn('Workflow cache invalidation unavailable after commit')
  }
}
function failed(error: unknown, operation: string) {
  if (error instanceof CfoScopeError) throw error
  logger.error(`Workflow ${operation} failed`, {
    errorName: error instanceof Error ? error.name : 'unknown',
  })
  return { success: false }
}
export async function createWorkflowTemplate(data: {
  name: string
  description?: string
  trigger: WorkflowTemplate['trigger']
  steps: WorkflowStep[]
  organizationId?: string
}): Promise<{ success: boolean }> {
  try {
    const result = await resolveOrgContext(
      'organization',
      { permission: 'workflows:create', organizationId: data?.organizationId },
      (context) => createWorkflow(context, data),
    )
    refresh()
    return result
  } catch (error) {
    return failed(error, 'create')
  }
}
export async function getWorkflowTemplate(templateId: string): Promise<WorkflowTemplate | null> {
  return resolveOrgContext('resource', { permission: 'workflows:view' }, (context) =>
    readWorkflow(context, templateId),
  )
}
export async function startWorkflowInstance(
  templateId: string,
): Promise<{ success: boolean; instanceId?: string }> {
  try {
    const result = await resolveOrgContext(
      'resource',
      { permission: 'workflows:create' },
      (context) => startWorkflow(context, templateId),
    )
    refresh()
    return result
  } catch (error) {
    return failed(error, 'start')
  }
}
export async function getWorkflowInstance(instanceId: string): Promise<WorkflowInstance | null> {
  return resolveOrgContext('resource', { permission: 'workflows:view' }, (context) =>
    readWorkflowInstance(context, instanceId),
  )
}
export async function listWorkflowInstances(): Promise<WorkflowInstance[]> {
  return resolveOrgContext('resource', { permission: 'workflows:view' }, listInstances)
}
export async function approveWorkflowStep(
  instanceId: string,
  comment?: string,
): Promise<{ success: boolean }> {
  try {
    const result = await resolveOrgContext(
      'resource',
      { permission: 'workflows:manage' },
      (context) => decideWorkflowStep(context, instanceId, 'approved', comment),
    )
    refresh()
    return result
  } catch (error) {
    return failed(error, 'approve')
  }
}
export async function rejectWorkflowStep(
  instanceId: string,
  comment: string,
): Promise<{ success: boolean }> {
  try {
    const result = await resolveOrgContext(
      'resource',
      { permission: 'workflows:manage' },
      (context) => decideWorkflowStep(context, instanceId, 'rejected', comment),
    )
    refresh()
    return result
  } catch (error) {
    return failed(error, 'reject')
  }
}
