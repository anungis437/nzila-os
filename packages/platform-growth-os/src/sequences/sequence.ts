/**
 * @nzila/platform-growth-os — Outreach Sequence CRUD + instance management
 */
import { z } from 'zod'
import { listRecords, readRecord, writeRecord } from '../store'
import { makeId, nowISO } from '../utils'
import { UE_SEQUENCES } from './templates'
import type { OutreachSequence, SequenceInstance, SequenceInstanceStatus } from './types'

// ── Schemas (minimal — full validation via Zod) ───────────────────────────────

const sequenceStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  delayHours: z.number().nonnegative(),
  channel: z.string(),
  templateId: z.string(),
  personalisationFields: z.array(z.string()),
  sendCondition: z.string().nullable(),
  stopOnEvent: z.string().nullable(),
  goal: z.string(),
})

const sequenceSchema = z.object({
  id: z.string().min(1),
  scope: z.object({ tenantId: z.string(), orgId: z.string(), product: z.string().optional() }),
  label: z.string(),
  kind: z.string(),
  description: z.string(),
  targetTiers: z.array(z.enum(['A', 'B', 'C'])),
  triggerStage: z.string(),
  steps: z.array(sequenceStepSchema),
  benchmarkReplyRate: z.number().min(0).max(1).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const completedStepSchema = z.object({
  stepNumber: z.number().int(),
  completedAt: z.string(),
  channel: z.string(),
  outcome: z.enum(['sent', 'replied', 'bounced', 'opted_out', 'skipped']),
  notes: z.string(),
})

const instanceSchema = z.object({
  id: z.string().min(1),
  sequenceId: z.string(),
  targetOrgId: z.string(),
  dealEngineId: z.string().nullable(),
  contactName: z.string(),
  contactEmail: z.string().email(),
  currentStepNumber: z.number().int(),
  status: z.enum(['active', 'paused', 'completed', 'stopped']),
  nextStepAt: z.string().nullable(),
  completedSteps: z.array(completedStepSchema),
  startedAt: z.string(),
  updatedAt: z.string(),
})

const SEQ_ENTITY      = 'sequence'
const INSTANCE_ENTITY = 'sequence-instance'

// ── Sequences ─────────────────────────────────────────────────────────────────

export function createSequence(input: Omit<OutreachSequence, 'id'>): OutreachSequence {
  const record: OutreachSequence = { id: makeId('seq'), ...input }
  return writeRecord(SEQ_ENTITY, record.id, record, sequenceSchema) as OutreachSequence
}

export function getSequence(id: string): OutreachSequence | null {
  return readRecord(SEQ_ENTITY, id, sequenceSchema) as OutreachSequence | null
}

export function listSequences(): OutreachSequence[] {
  return listRecords(SEQ_ENTITY, sequenceSchema) as OutreachSequence[]
}

/** Bootstrap canonical UE sequences if none exist. Idempotent. */
export function bootstrapSequences(): OutreachSequence[] {
  const existing = listSequences()
  if (existing.length > 0) return existing
  return UE_SEQUENCES.map((s) => createSequence(s))
}

// ── Instances ─────────────────────────────────────────────────────────────────

export interface EnrollInput {
  sequenceId: string
  targetOrgId: string
  dealEngineId: string | null
  contactName: string
  contactEmail: string
}

export function enrollInSequence(input: EnrollInput): SequenceInstance {
  const seq = getSequence(input.sequenceId)
  const firstStep = seq?.steps[0]
  const now = nowISO()
  const nextStepAt = firstStep
    ? new Date(Date.now() + firstStep.delayHours * 3600 * 1000).toISOString()
    : null

  const record: SequenceInstance = {
    id: makeId('si'),
    ...input,
    currentStepNumber: 1,
    status: 'active',
    nextStepAt,
    completedSteps: [],
    startedAt: now,
    updatedAt: now,
  }
  return writeRecord(INSTANCE_ENTITY, record.id, record, instanceSchema) as SequenceInstance
}

export function getSequenceInstance(id: string): SequenceInstance | null {
  return readRecord(INSTANCE_ENTITY, id, instanceSchema) as SequenceInstance | null
}

export function listSequenceInstances(): SequenceInstance[] {
  return listRecords(INSTANCE_ENTITY, instanceSchema) as SequenceInstance[]
}

export function listInstancesByStatus(status: SequenceInstanceStatus): SequenceInstance[] {
  return listSequenceInstances().filter((i) => i.status === status)
}

export function updateInstanceStatus(
  id: string,
  status: SequenceInstanceStatus,
): SequenceInstance | null {
  const existing = getSequenceInstance(id)
  if (!existing) return null
  const updated = { ...existing, status, updatedAt: nowISO() }
  return writeRecord(INSTANCE_ENTITY, id, updated, instanceSchema) as SequenceInstance
}
