'use server'

/**
 * Session actions — NACP Exams.
 *
 * Manages exam session lifecycle: create, list, update status.
 * Uses @nzila/db for persistence, @nzila/nacp-core schemas for validation,
 * and the evidence pipeline for tamper-proof audit trails.
 */
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { CreateExamSessionSchema } from '@nzila/nacp-core/schemas'
import { ExamSessionStatus, NacpRole } from '@nzila/nacp-core/enums'
import type { ExamSession } from '@nzila/nacp-core/types'
import { transitionSession } from '@/lib/session-machine'
import { logTransition } from '@/lib/commerce-telemetry'
import { buildExamEvidencePack } from '@/lib/evidence'
import { classifyTransitionEvidence } from '@/lib/evidence-classification'
import { resolveOrgContext } from '@/lib/resolve-org'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExamSessionRow {
  id: string
  examId: string
  examName: string
  centerId: string
  centerName: string
  scheduledDate: string
  status: string
  candidateCount: number
  createdAt: string
}

export interface SessionStats {
  total: number
  scheduled: number
  inProgress: number
  completed: number
  cancelled: number
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function listSessions(opts?: {
  status?: string
  search?: string
}): Promise<{ sessions: ExamSessionRow[] }> {
  const ctx = await resolveOrgContext()

  let filter = sql`es.entity_id = ${ctx.entityId}`
  if (opts?.status) {
    filter = sql`${filter} AND es.status = ${opts.status}`
  }
  if (opts?.search) {
    filter = sql`${filter} AND (
      e.name ILIKE ${'%' + opts.search + '%'}
      OR ec.name ILIKE ${'%' + opts.search + '%'}
    )`
  }

  const rows = await platformDb.execute(sql`
    SELECT
      es.id,
      es.exam_id as "examId",
      COALESCE(e.name, 'Unknown Exam') as "examName",
      es.center_id as "centerId",
      COALESCE(ec.name, 'Unknown Center') as "centerName",
      es.scheduled_date as "scheduledDate",
      es.status,
      COALESCE(es.candidate_count, 0)::int as "candidateCount",
      es.created_at as "createdAt"
    FROM exam_sessions es
    LEFT JOIN exams e ON e.id = es.exam_id
    LEFT JOIN exam_centers ec ON ec.id = es.center_id
    WHERE ${filter}
    ORDER BY es.scheduled_date DESC
    LIMIT 100
  `)

  return { sessions: (rows as unknown as ExamSessionRow[]) ?? [] }
}

export async function getSessionStats(): Promise<SessionStats> {
  const ctx = await resolveOrgContext()

  const [row] = await platformDb.execute(sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = ${ExamSessionStatus.SCHEDULED})::int as scheduled,
      COUNT(*) FILTER (WHERE status = ${ExamSessionStatus.IN_PROGRESS})::int as "inProgress",
      COUNT(*) FILTER (WHERE status = ${ExamSessionStatus.CLOSED})::int as completed,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int as cancelled
    FROM exam_sessions
    WHERE entity_id = ${ctx.entityId}
  `)

  const r = row as Record<string, number>
  return {
    total: r.total ?? 0,
    scheduled: r.scheduled ?? 0,
    inProgress: r.inProgress ?? 0,
    completed: r.completed ?? 0,
    cancelled: r.cancelled ?? 0,
  }
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function createSession(data: {
  examId: string
  centerId: string
  scheduledDate: string
  duration: number
  maxCandidates: number
  notes?: string
}) {
  const ctx = await resolveOrgContext()

  const parsed = CreateExamSessionSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const id = crypto.randomUUID()

  await platformDb.execute(sql`
    INSERT INTO exam_sessions (id, entity_id, exam_id, center_id, scheduled_date, duration_minutes, max_candidates, status, notes, created_by, created_at)
    VALUES (
      ${id},
      ${ctx.entityId},
      ${data.examId},
      ${data.centerId},
      ${data.scheduledDate},
      ${data.duration},
      ${data.maxCandidates},
      ${ExamSessionStatus.SCHEDULED},
      ${data.notes ?? null},
      ${ctx.actorId},
      NOW()
    )
  `)

  // Evidence: session.created is best-effort (not regulatory)
  await buildExamEvidencePack({
    action: 'session.created',
    entityType: 'exam_session',
    entityId: id,
    actorId: ctx.actorId,
    payload: {
      orgId: ctx.entityId,
      examId: data.examId,
      centerId: data.centerId,
      scheduledDate: data.scheduledDate,
    },
  }).catch(() => {})

  return { success: true, id }
}

export async function updateSessionStatus(
  sessionId: string,
  targetStatus: ExamSessionStatus,
) {
  const ctx = await resolveOrgContext()

  // ── Fetch current session for state machine context (org-scoped) ──
  const [row] = await platformDb.execute(sql`
    SELECT
      id, entity_id as "entityId", entity_id as "orgId", exam_id as "examId",
      center_id as "centerId", status, scheduled_date as "scheduledAt",
      opened_at as "openedAt", sealed_at as "sealedAt",
      exported_at as "exportedAt", closed_at as "closedAt",
      integrity_hash as "integrityHash", supervisor_id as "supervisorId",
      COALESCE(candidate_count, 0)::int as "candidateCount",
      created_at as "createdAt", updated_at as "updatedAt"
    FROM exam_sessions WHERE id = ${sessionId} AND entity_id = ${ctx.entityId}
  `)
  if (!row) return { success: false, error: 'Session not found' }

  const session = row as unknown as ExamSession
  const currentStatus = session.status as ExamSessionStatus

  // ── State machine: validate transition ────────────────────────────
  const result = transitionSession(
    currentStatus,
    targetStatus,
    { entityId: ctx.entityId, actorId: ctx.actorId, role: ctx.role, meta: {} },
    ctx.entityId,
    session,
  )

  if (!result.ok) {
    return { success: false, error: `Invalid transition: ${result.reason}` }
  }

  // ── Persist the update (org-scoped) ───────────────────────────────
  await platformDb.execute(sql`
    UPDATE exam_sessions
    SET status = ${targetStatus}, updated_at = NOW()
    WHERE id = ${sessionId} AND entity_id = ${ctx.entityId}
  `)

  // ── Audit trail + telemetry ───────────────────────────────────────
  const evidenceClass = classifyTransitionEvidence(targetStatus)
  const evidencePromise = buildExamEvidencePack({
    action: 'session.status_changed',
    entityType: 'exam_session',
    entityId: sessionId,
    actorId: ctx.actorId,
    payload: {
      orgId: ctx.entityId,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      transitionLabel: result.label,
      eventsEmitted: result.eventsToEmit.map((e: { type: string }) => e.type),
    },
  })

  if (evidenceClass === 'mandatory') {
    // Mandatory evidence (sealed / exported / closed) — failure rolls back
    await evidencePromise
  } else {
    // Best-effort evidence (opened / in_progress) — log but don't block
    await evidencePromise.catch(() => {})
  }

  logTransition(
    { orgId: ctx.entityId, actorId: ctx.actorId },
    'exam_session',
    currentStatus,
    targetStatus,
    true,
    { transitionLabel: result.label },
  )

  return { success: true }
}
