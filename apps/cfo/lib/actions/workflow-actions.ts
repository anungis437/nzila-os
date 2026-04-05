/**
 * CFO Server Actions — Workflow Builder & Execution Engine.
 *
 * Create workflow templates with configurable triggers and steps.
 * Execute workflows step-by-step with approve/reject and notifications.
 */
'use server'

import { auth } from '@nzila/platform-auth/entra/server'
import { requirePermission } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

/* ─── Types ─── */

export interface WorkflowStep {
  name: string
  assigneeRole: 'accountant' | 'manager' | 'partner' | 'client'
  actionType: 'review' | 'approve' | 'edit' | 'sign' | 'notify'
  dueHours: number
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  trigger: 'report_created' | 'alert_triggered' | 'document_uploaded' | 'client_onboarded' | 'manual'
  steps: WorkflowStep[]
  status: 'active' | 'inactive'
  createdAt: Date
}

export interface WorkflowInstanceStep {
  stepIndex: number
  name: string
  assigneeRole: string
  actionType: string
  status: 'pending' | 'completed' | 'rejected' | 'skipped'
  comment: string | null
  completedAt: Date | null
  completedBy: string | null
}

export interface WorkflowInstance {
  id: string
  templateId: string
  templateName: string
  status: 'in-progress' | 'completed' | 'rejected'
  currentStep: number
  steps: WorkflowInstanceStep[]
  createdAt: Date
}

/* ─── Template Management ─── */

export async function createWorkflowTemplate(data: {
  name: string
  description?: string
  trigger: WorkflowTemplate['trigger']
  steps: WorkflowStep[]
}): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('workflows:create')

  try {
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('workflow.registered', ${userId}, 'workflow', 'platform',
        ${JSON.stringify({
          name: data.name,
          description: data.description ?? '',
          trigger: data.trigger,
          steps: data.steps,
          status: 'active',
          runCount: 0,
          lastRun: null,
        })}::jsonb)`,
    )
    revalidatePath('/dashboard/workflows')
    return { success: true }
  } catch (error) {
    logger.error('createWorkflowTemplate failed', { error })
    return { success: false }
  }
}

export async function getWorkflowTemplate(templateId: string): Promise<WorkflowTemplate | null> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('workflows:view')

  try {
    const [row] = (await platformDb.execute(
      sql`SELECT id, metadata->>'name' as name, metadata->>'description' as description,
        metadata->>'trigger' as trigger, metadata->'steps' as steps,
        metadata->>'status' as status, created_at as "createdAt"
      FROM audit_log WHERE id = ${templateId} AND action = 'workflow.registered'`,
    )) as unknown as [WorkflowTemplate | undefined]

    if (!row) return null
    return {
      ...row,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
    }
  } catch (error) {
    logger.error('getWorkflowTemplate failed', { error })
    return null
  }
}

/* ─── Instance Management ─── */

export async function startWorkflowInstance(templateId: string): Promise<{ success: boolean; instanceId?: string }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('workflows:create')

  try {
    const template = await getWorkflowTemplate(templateId)
    if (!template) return { success: false }

    const steps: WorkflowInstanceStep[] = template.steps.map((s, i) => ({
      stepIndex: i,
      name: s.name,
      assigneeRole: s.assigneeRole,
      actionType: s.actionType,
      status: i === 0 ? 'pending' : 'pending',
      comment: null,
      completedAt: null,
      completedBy: null,
    }))

    const result = (await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('workflow.instance.created', ${userId}, 'workflow_instance', ${templateId},
        ${JSON.stringify({
          templateId,
          templateName: template.name,
          status: 'in-progress',
          currentStep: 0,
          steps,
        })}::jsonb) RETURNING id`,
    )) as unknown as { rows: { id: string }[] }

    // Update template run count
    await platformDb.execute(
      sql`UPDATE audit_log SET metadata = metadata ||
        jsonb_build_object('runCount', COALESCE((metadata->>'runCount')::int, 0) + 1, 'lastRun', NOW()::text)
      WHERE id = ${templateId} AND action = 'workflow.registered'`,
    )

    revalidatePath('/dashboard/workflows')
    return { success: true, instanceId: result.rows?.[0]?.id }
  } catch (error) {
    logger.error('startWorkflowInstance failed', { error })
    return { success: false }
  }
}

export async function getWorkflowInstance(instanceId: string): Promise<WorkflowInstance | null> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('workflows:view')

  try {
    const [row] = (await platformDb.execute(
      sql`SELECT id, org_id as "templateId",
        metadata->>'templateName' as "templateName",
        metadata->>'status' as status,
        COALESCE((metadata->>'currentStep')::int, 0) as "currentStep",
        metadata->'steps' as steps,
        created_at as "createdAt"
      FROM audit_log WHERE id = ${instanceId} AND action = 'workflow.instance.created'`,
    )) as unknown as [WorkflowInstance | undefined]

    if (!row) return null
    return {
      ...row,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
    }
  } catch (error) {
    logger.error('getWorkflowInstance failed', { error })
    return null
  }
}

export async function listWorkflowInstances(): Promise<WorkflowInstance[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('workflows:view')

  try {
    const rows = (await platformDb.execute(
      sql`SELECT id, org_id as "templateId",
        metadata->>'templateName' as "templateName",
        metadata->>'status' as status,
        COALESCE((metadata->>'currentStep')::int, 0) as "currentStep",
        metadata->'steps' as steps,
        created_at as "createdAt"
      FROM audit_log WHERE action = 'workflow.instance.created'
      ORDER BY created_at DESC LIMIT 50`,
    )) as unknown as { rows: WorkflowInstance[] }

    return (rows.rows ?? []).map((r) => ({
      ...r,
      steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps,
    }))
  } catch (error) {
    logger.error('listWorkflowInstances failed', { error })
    return []
  }
}

export async function approveWorkflowStep(
  instanceId: string,
  comment?: string,
): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('workflows:manage')

  try {
    const instance = await getWorkflowInstance(instanceId)
    if (!instance || instance.status !== 'in-progress') return { success: false }

    const steps = [...instance.steps]
    const current = steps[instance.currentStep]
    if (!current) return { success: false }

    current.status = 'completed'
    current.comment = comment ?? null
    current.completedAt = new Date()
    current.completedBy = userId

    const isLast = instance.currentStep >= steps.length - 1
    const newStatus = isLast ? 'completed' : 'in-progress'
    const newStep = isLast ? instance.currentStep : instance.currentStep + 1

    await platformDb.execute(
      sql`UPDATE audit_log SET metadata = metadata ||
        ${JSON.stringify({ steps, currentStep: newStep, status: newStatus })}::jsonb
      WHERE id = ${instanceId} AND action = 'workflow.instance.created'`,
    )

    // Log step completion
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('workflow.step.approved', ${userId}, 'workflow_instance', ${instanceId},
        ${JSON.stringify({
          stepIndex: instance.currentStep,
          stepName: current.name,
          comment: comment ?? null,
        })}::jsonb)`,
    )

    revalidatePath('/dashboard/workflows')
    return { success: true }
  } catch (error) {
    logger.error('approveWorkflowStep failed', { error })
    return { success: false }
  }
}

export async function rejectWorkflowStep(
  instanceId: string,
  comment: string,
): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('workflows:manage')

  try {
    const instance = await getWorkflowInstance(instanceId)
    if (!instance || instance.status !== 'in-progress') return { success: false }

    const steps = [...instance.steps]
    const current = steps[instance.currentStep]
    if (!current) return { success: false }

    current.status = 'rejected'
    current.comment = comment
    current.completedAt = new Date()
    current.completedBy = userId

    await platformDb.execute(
      sql`UPDATE audit_log SET metadata = metadata ||
        ${JSON.stringify({ steps, status: 'rejected' })}::jsonb
      WHERE id = ${instanceId} AND action = 'workflow.instance.created'`,
    )

    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('workflow.step.rejected', ${userId}, 'workflow_instance', ${instanceId},
        ${JSON.stringify({
          stepIndex: instance.currentStep,
          stepName: current.name,
          comment,
        })}::jsonb)`,
    )

    revalidatePath('/dashboard/workflows')
    return { success: true }
  } catch (error) {
    logger.error('rejectWorkflowStep failed', { error })
    return { success: false }
  }
}
