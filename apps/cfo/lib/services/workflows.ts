import { z } from 'zod'
import type { CfoActionContext } from '@/lib/resolve-org'
import { CfoScopeError, assertCfoContextPermission } from '@/lib/resolve-org'
import {
  createCfoRecord,
  getCfoRecord,
  listCfoRecords,
  updateCfoWorkflowRecord,
  type CfoRecord,
} from './cfo-records'

const step = z
  .object({
    name: z.string().min(1),
    assigneeRole: z.enum(['accountant', 'manager', 'partner', 'client']),
    actionType: z.enum(['review', 'approve', 'edit', 'sign', 'notify']),
    dueHours: z.number().finite().positive(),
  })
  .strict()
const trigger = z.enum([
  'report_created',
  'alert_triggered',
  'document_uploaded',
  'client_onboarded',
  'manual',
])
const input = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    trigger,
    steps: z.array(step).min(1),
    organizationId: z.string().optional(),
  })
  .strict()
export type WorkflowStep = z.infer<typeof step>
export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  trigger: z.infer<typeof trigger>
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
const storedTemplate = z.object({
  name: z.string(),
  description: z.string().default(''),
  trigger,
  steps: z.array(step).min(1),
  status: z.enum(['active', 'inactive']),
  runCount: z.number().int().nonnegative().optional(),
  lastRun: z.string().nullable().optional(),
})
const instanceStep = z.object({
  stepIndex: z.number().int().nonnegative(),
  name: z.string(),
  assigneeRole: z.string(),
  actionType: z.string(),
  status: z.enum(['pending', 'completed', 'rejected', 'skipped']),
  comment: z.string().nullable(),
  completedAt: z.coerce.date().nullable(),
  completedBy: z.string().nullable(),
})
const storedInstance = z.object({
  templateId: z.string().uuid().optional(),
  templateName: z.string(),
  status: z.enum(['in-progress', 'completed', 'rejected']),
  currentStep: z.number().int().nonnegative(),
  steps: z.array(instanceStep).min(1),
})
function template(record: CfoRecord): WorkflowTemplate {
  const data = storedTemplate.parse(record.metadata)
  return {
    id: record.id,
    name: data.name,
    description: data.description,
    trigger: data.trigger,
    steps: data.steps,
    status: data.status,
    createdAt: record.createdAt,
  }
}
function instance(record: CfoRecord): WorkflowInstance {
  const data = storedInstance.parse(record.metadata)
  // Historical instances used org_id for the template ID. The verified parent
  // is required by the record loader; no field here establishes jurisdiction.
  const templateId = data.templateId
  if (!templateId) throw new CfoScopeError('Workflow parent is unavailable')
  return {
    id: record.id,
    templateId,
    templateName: data.templateName,
    status: data.status,
    currentStep: data.currentStep,
    steps: data.steps,
    createdAt: record.createdAt,
  }
}
export async function createWorkflow(context: CfoActionContext, data: z.input<typeof input>) {
  const { organizationId: _selector, ...value } = input.parse(data)
  await createCfoRecord(context, {
    action: 'workflow.registered',
    metadata: {
      ...value,
      description: value.description ?? '',
      status: 'active',
      runCount: 0,
      lastRun: null,
    },
  })
  return { success: true }
}
export async function readWorkflow(context: CfoActionContext, id: string) {
  const record = await getCfoRecord(context, id, ['workflow.registered'])
  return record ? template(record) : null
}
export async function listWorkflowTemplates(context: CfoActionContext) {
  return (await listCfoRecords(context, 'workflow.registered'))
    .map((record) => ({
      ...template(record),
      runCount: storedTemplate.parse(record.metadata).runCount ?? 0,
      lastRun: record.metadata.lastRun ? new Date(String(record.metadata.lastRun)) : null,
    }))
    .slice(0, 100)
}
export async function startWorkflow(context: CfoActionContext, id: string) {
  assertCfoContextPermission(context, 'workflows:create')
  // Take the template's actual update lock before creating its fresh child.
  const parent = await getCfoRecord(context, id, ['workflow.registered'], { lock: 'update' })
  if (!parent) return { success: false }
  const config = storedTemplate.parse(parent.metadata)
  if (config.status !== 'active') return { success: false }
  const steps: WorkflowInstanceStep[] = config.steps.map((value, i) => ({
    ...value,
    stepIndex: i,
    status: 'pending',
    comment: null,
    completedAt: null,
    completedBy: null,
  }))
  const child = await createCfoRecord(context, {
    action: 'workflow.instance.created',
    parent,
    metadata: { templateName: config.name, status: 'in-progress', currentStep: 0, steps },
  })
  await updateCfoWorkflowRecord(
    context,
    parent,
    { runCount: (config.runCount ?? 0) + 1, lastRun: new Date().toISOString() },
    'started',
    { instanceId: child.id },
  )
  return { success: true, instanceId: child.id }
}
export async function readWorkflowInstance(context: CfoActionContext, id: string) {
  const record = await getCfoRecord(context, id, ['workflow.instance.created'])
  return record ? instance(record) : null
}
export async function listInstances(context: CfoActionContext) {
  return (await listCfoRecords(context, 'workflow.instance.created')).map(instance).slice(0, 50)
}
export async function decideWorkflowStep(
  context: CfoActionContext,
  id: string,
  operation: 'approved' | 'rejected',
  comment?: string,
) {
  assertCfoContextPermission(context, 'workflows:manage')
  z.string().optional().parse(comment)
  const record = await getCfoRecord(context, id, ['workflow.instance.created'], {
    lock: 'update',
    manage: true,
  })
  if (!record) return { success: false }
  const current = instance(record)
  if (current.status !== 'in-progress') return { success: false }
  const steps = current.steps.map((value) => ({ ...value })),
    active = steps[current.currentStep]
  if (!active || active.stepIndex !== current.currentStep || active.status !== 'pending')
    return { success: false }
  active.status = operation === 'approved' ? 'completed' : 'rejected'
  active.comment = comment ?? null
  active.completedAt = new Date()
  active.completedBy = context.userId
  const isLast = current.currentStep >= steps.length - 1
  const status = operation === 'rejected' ? 'rejected' : isLast ? 'completed' : 'in-progress'
  const currentStep =
    operation === 'approved' && !isLast ? current.currentStep + 1 : current.currentStep
  await updateCfoWorkflowRecord(context, record, { steps, currentStep, status }, operation, {
    stepIndex: current.currentStep,
    stepName: active.name,
    comment: comment ?? null,
  })
  return { success: true }
}
