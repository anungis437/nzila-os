/**
 * Platform Admin — ITSM org-scoped query helpers
 *
 * All helpers in this module REQUIRE an `orgId` and apply it as a filter on
 * every read and write. Callers are expected to have first verified the
 * actor's membership in `orgId` via `requireOrgScope()` from
 * `./org-scope-guard.ts` — these helpers do NOT re-check authorization.
 *
 * Schema notes:
 *  - `itsm_queues`, `itsm_slas`, `itsm_approvals` are org-scoped via `org_id`.
 *  - `itsm_queues.member_ids` is JSON (array of user IDs).
 *  - `itsm_slas.targets` is JSON shaped per `SlaTargets` from `@nzila/itsm-core`.
 *  - `itsm_approvals.subject_type` is a free-text discriminator
 *    ('ticket' | 'change' | 'access_request').
 */
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import {
  itsmQueues,
  itsmSlas,
  itsmApprovals,
  itsmTickets,
} from '@nzila/db/schema'
import { slaTargetsSchema, type SlaTargets } from '@nzila/itsm-core'
import { z } from 'zod'

// ── Schemas (input validation) ────────────────────────────────────────────────

export const createQueueSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  memberIds: z.array(z.string().min(1)).max(500).default([]),
  defaultSlaId: z.string().uuid().optional().nullable(),
  active: z.boolean().default(true),
})
export type CreateQueueInput = z.infer<typeof createQueueSchema>

export const updateQueueSchema = createQueueSchema.partial()
export type UpdateQueueInput = z.infer<typeof updateQueueSchema>

export const createSlaProfileSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  targets: slaTargetsSchema,
  contractId: z.string().uuid().optional().nullable(),
  active: z.boolean().default(true),
})
export type CreateSlaProfileInput = z.infer<typeof createSlaProfileSchema>

export const updateSlaProfileSchema = createSlaProfileSchema.partial()
export type UpdateSlaProfileInput = z.infer<typeof updateSlaProfileSchema>

export const approvalDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  decisionNote: z.string().max(2000).optional(),
})
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>

// ── Queue helpers ─────────────────────────────────────────────────────────────

export interface QueueRow {
  id: string
  name: string
  description: string | null
  memberCount: number
  defaultSlaId: string | null
  defaultSlaName: string | null
  openTicketCount: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export async function listQueues(orgId: string): Promise<QueueRow[]> {
  const rows = await platformDb
    .select({
      id: itsmQueues.id,
      name: itsmQueues.name,
      description: itsmQueues.description,
      memberIds: itsmQueues.memberIds,
      defaultSlaId: itsmQueues.defaultSlaId,
      defaultSlaName: itsmSlas.name,
      active: itsmQueues.active,
      createdAt: itsmQueues.createdAt,
      updatedAt: itsmQueues.updatedAt,
    })
    .from(itsmQueues)
    .leftJoin(itsmSlas, eq(itsmSlas.id, itsmQueues.defaultSlaId))
    .where(eq(itsmQueues.orgId, orgId))
    .orderBy(desc(itsmQueues.createdAt))

  if (rows.length === 0) return []

  const queueIds = rows.map((r) => r.id)
  const ticketCounts = await platformDb
    .select({
      queueId: itsmTickets.queueId,
      count: count(itsmTickets.id),
    })
    .from(itsmTickets)
    .where(
      and(
        eq(itsmTickets.orgId, orgId),
        inArray(itsmTickets.queueId, queueIds),
        // Count only "open" tickets — exclude resolved/closed.
        sql`${itsmTickets.status} NOT IN ('resolved', 'closed')`,
      ),
    )
    .groupBy(itsmTickets.queueId)

  const countByQueue = new Map<string, number>()
  for (const row of ticketCounts) {
    if (row.queueId) countByQueue.set(row.queueId, Number(row.count))
  }

  return rows.map((r) => {
    const members = Array.isArray(r.memberIds) ? (r.memberIds as string[]) : []
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      memberCount: members.length,
      defaultSlaId: r.defaultSlaId,
      defaultSlaName: r.defaultSlaName,
      openTicketCount: countByQueue.get(r.id) ?? 0,
      active: r.active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  })
}

export async function createQueue(orgId: string, input: CreateQueueInput) {
  const [row] = await platformDb
    .insert(itsmQueues)
    .values({
      orgId,
      name: input.name,
      description: input.description,
      memberIds: input.memberIds,
      defaultSlaId: input.defaultSlaId ?? null,
      active: input.active,
    })
    .returning()
  return row
}

export async function updateQueue(
  orgId: string,
  queueId: string,
  input: UpdateQueueInput,
) {
  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description
  if (input.memberIds !== undefined) patch.memberIds = input.memberIds
  if (input.defaultSlaId !== undefined)
    patch.defaultSlaId = input.defaultSlaId ?? null
  if (input.active !== undefined) patch.active = input.active

  const [row] = await platformDb
    .update(itsmQueues)
    .set(patch)
    .where(and(eq(itsmQueues.orgId, orgId), eq(itsmQueues.id, queueId)))
    .returning()
  return row ?? null
}

export async function deleteQueue(orgId: string, queueId: string) {
  const [row] = await platformDb
    .delete(itsmQueues)
    .where(and(eq(itsmQueues.orgId, orgId), eq(itsmQueues.id, queueId)))
    .returning({ id: itsmQueues.id })
  return row ?? null
}

// ── SLA profile helpers ───────────────────────────────────────────────────────

export interface SlaProfileRow {
  id: string
  name: string
  description: string | null
  targets: SlaTargets
  contractId: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export async function listSlaProfiles(orgId: string): Promise<SlaProfileRow[]> {
  const rows = await platformDb
    .select()
    .from(itsmSlas)
    .where(eq(itsmSlas.orgId, orgId))
    .orderBy(desc(itsmSlas.createdAt))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    targets: r.targets as SlaTargets,
    contractId: r.contractId,
    active: r.active,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

export async function createSlaProfile(
  orgId: string,
  input: CreateSlaProfileInput,
) {
  const [row] = await platformDb
    .insert(itsmSlas)
    .values({
      orgId,
      name: input.name,
      description: input.description,
      targets: input.targets,
      contractId: input.contractId ?? null,
      active: input.active,
    })
    .returning()
  return row
}

export async function updateSlaProfile(
  orgId: string,
  slaId: string,
  input: UpdateSlaProfileInput,
) {
  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description
  if (input.targets !== undefined) patch.targets = input.targets
  if (input.contractId !== undefined)
    patch.contractId = input.contractId ?? null
  if (input.active !== undefined) patch.active = input.active

  const [row] = await platformDb
    .update(itsmSlas)
    .set(patch)
    .where(and(eq(itsmSlas.orgId, orgId), eq(itsmSlas.id, slaId)))
    .returning()
  return row ?? null
}

export async function deleteSlaProfile(orgId: string, slaId: string) {
  // Safety: refuse delete if any queue still references this profile.
  const [referenced] = await platformDb
    .select({ count: count(itsmQueues.id) })
    .from(itsmQueues)
    .where(
      and(eq(itsmQueues.orgId, orgId), eq(itsmQueues.defaultSlaId, slaId)),
    )
  if (Number(referenced?.count ?? 0) > 0) {
    return { error: 'SLA_PROFILE_IN_USE' as const }
  }

  const [row] = await platformDb
    .delete(itsmSlas)
    .where(and(eq(itsmSlas.orgId, orgId), eq(itsmSlas.id, slaId)))
    .returning({ id: itsmSlas.id })
  return { deleted: row?.id ?? null }
}

// ── Approval helpers ──────────────────────────────────────────────────────────

export interface ApprovalRow {
  id: string
  subjectType: string
  subjectId: string
  status: string
  requestedById: string
  approverId: string
  decision: string | null
  decisionNote: string | null
  dueBy: Date | null
  decidedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ApprovalStats {
  totalActive: number
  pending: number
  approved: number
  rejected: number
  escalated: number
}

export async function listApprovals(
  orgId: string,
  options: { status?: 'pending' | 'approved' | 'rejected' | 'escalated'; limit?: number } = {},
): Promise<ApprovalRow[]> {
  const conds = [eq(itsmApprovals.orgId, orgId)]
  if (options.status) {
    conds.push(eq(itsmApprovals.status, options.status))
  }
  const rows = await platformDb
    .select()
    .from(itsmApprovals)
    .where(and(...conds))
    .orderBy(desc(itsmApprovals.createdAt))
    .limit(options.limit ?? 200)

  return rows.map((r) => ({
    id: r.id,
    subjectType: r.subjectType,
    subjectId: r.subjectId,
    status: r.status,
    requestedById: r.requestedById,
    approverId: r.approverId,
    decision: r.decision,
    decisionNote: r.decisionNote,
    dueBy: r.dueBy,
    decidedAt: r.decidedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

export async function getApprovalStats(orgId: string): Promise<ApprovalStats> {
  const rows = await platformDb
    .select({
      status: itsmApprovals.status,
      count: count(itsmApprovals.id),
    })
    .from(itsmApprovals)
    .where(eq(itsmApprovals.orgId, orgId))
    .groupBy(itsmApprovals.status)

  const stats: ApprovalStats = {
    totalActive: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    escalated: 0,
  }
  for (const row of rows) {
    const n = Number(row.count)
    switch (row.status) {
      case 'pending':
        stats.pending = n
        break
      case 'approved':
        stats.approved = n
        break
      case 'rejected':
        stats.rejected = n
        break
      case 'escalated':
        stats.escalated = n
        break
    }
  }
  stats.totalActive = stats.pending + stats.escalated
  return stats
}

export async function decideApproval(
  orgId: string,
  approvalId: string,
  actorId: string,
  input: ApprovalDecisionInput,
) {
  // Only the assigned approver may decide.
  const [existing] = await platformDb
    .select({
      id: itsmApprovals.id,
      approverId: itsmApprovals.approverId,
      status: itsmApprovals.status,
    })
    .from(itsmApprovals)
    .where(
      and(eq(itsmApprovals.orgId, orgId), eq(itsmApprovals.id, approvalId)),
    )
    .limit(1)

  if (!existing) return { error: 'NOT_FOUND' as const }
  if (existing.approverId !== actorId) return { error: 'NOT_APPROVER' as const }
  if (existing.status !== 'pending') {
    return { error: 'ALREADY_DECIDED' as const, status: existing.status }
  }

  const nextStatus = input.decision === 'approved' ? 'approved' : 'rejected'
  const [updated] = await platformDb
    .update(itsmApprovals)
    .set({
      status: nextStatus,
      decision: input.decision,
      decisionNote: input.decisionNote,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(itsmApprovals.orgId, orgId), eq(itsmApprovals.id, approvalId)),
    )
    .returning()

  return { updated }
}
