/**
 * Zonga Server Actions — Moderation & Integrity.
 *
 * Moderation case management, integrity signal handling,
 * and operator review workflows. All on domain tables.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { createNotification } from '@/lib/actions/notification-actions'
import { executeCommand } from '@/lib/control'

/* ─── Types ─── */

export interface ModerationCase {
  id: string
  entityType: string
  targetEntityId: string
  caseType: string
  status: string
  severity: string
  notes?: string
  assignedTo?: string
  resolvedAt?: Date
  createdAt?: Date
}

export interface IntegritySignal {
  id: string
  entityType: string
  targetEntityId: string
  signalType: string
  severity: string
  explanation?: string
  metadataJson?: Record<string, unknown>
  createdAt?: Date
}

export interface ModerationStats {
  openCases: number
  resolvedCases: number
  pendingReview: number
  criticalSignals: number
}

/* ─── Case Management ─── */

export async function listModerationCases(opts?: {
  status?: string
  severity?: string
  entityType?: string
}): Promise<ModerationCase[]> {
  const ctx = await resolveOrgContext()

  try {
    const statusFilter = opts?.status ? sql` AND status = ${opts.status}` : sql``
    const severityFilter = opts?.severity ? sql` AND severity = ${opts.severity}` : sql``
    const entityFilter = opts?.entityType ? sql` AND entity_type = ${opts.entityType}` : sql``

    const rows = (await platformDb.execute(
      sql`SELECT
        id,
        entity_type as "entityType",
        entity_id as "targetEntityId",
        case_type as "caseType",
        status,
        severity,
        notes,
        assigned_to as "assignedTo",
        resolved_at as "resolvedAt",
        created_at as "createdAt"
      FROM zonga_moderation_cases
      WHERE org_id = ${ctx.orgId}
      ${statusFilter} ${severityFilter} ${entityFilter}
      ORDER BY
        CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        created_at DESC
      LIMIT 200`,
    )) as unknown as { rows: ModerationCase[] }

    return rows.rows ?? []
  } catch (error) {
    logger.error('listModerationCases failed', { error })
    return []
  }
}

export async function getModerationCase(caseId: string): Promise<ModerationCase | null> {
  const ctx = await resolveOrgContext()

  try {
    const [row] = (await platformDb.execute(
      sql`SELECT
        id,
        entity_type as "entityType",
        entity_id as "targetEntityId",
        case_type as "caseType",
        status,
        severity,
        notes,
        assigned_to as "assignedTo",
        resolved_at as "resolvedAt",
        created_at as "createdAt"
      FROM zonga_moderation_cases
      WHERE id = ${caseId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [ModerationCase | undefined]

    return row ?? null
  } catch (error) {
    logger.error('getModerationCase failed', { error })
    return null
  }
}

export async function createModerationCase(data: {
  entityType: string
  targetEntityId: string
  caseType: string
  severity: string
  notes?: string
}): Promise<{ success: boolean; caseId?: string }> {
  const result = await executeCommand({
    type: 'create_moderation_case' as const,
    entity_type: data.entityType,
    target_entity_id: data.targetEntityId,
    case_type: data.caseType,
    severity: data.severity,
    notes: data.notes,
  })

  if (!result.success) {
    return { success: false }
  }

  revalidatePath('/dashboard/moderation')
  return { success: true, caseId: result.data?.entity_id }
}

export async function resolveModerationCase(
  caseId: string,
  data: { status: string; notes?: string },
): Promise<{ success: boolean }> {
  const ctx = await resolveOrgContext()

  const result = await executeCommand({
    type: 'resolve_moderation_case' as const,
    case_id: caseId,
    status: data.status,
    notes: data.notes,
    actor_id: ctx.actorId,
  })

  if (!result.success) {
    return { success: false }
  }

  // Side-effect: notify content owner on resolution
  if (data.status === 'resolved') {
    const modCase = await getModerationCase(caseId)
    if (modCase) {
      const [owner] = (await platformDb.execute(
        sql`SELECT CASE
          WHEN ${modCase.entityType} = 'asset' THEN (SELECT creator_id FROM zonga_content_assets WHERE id = ${modCase.targetEntityId})
          WHEN ${modCase.entityType} = 'release' THEN (SELECT creator_id FROM zonga_releases WHERE id = ${modCase.targetEntityId})
          ELSE NULL
        END as "ownerId"`,
      )) as unknown as [{ ownerId: string | null }]

      if (owner?.ownerId) {
        await createNotification({
          orgId: ctx.orgId,
          userId: owner.ownerId,
          type: 'moderation_resolved',
          title: 'Content review complete',
          body: `Your ${modCase.entityType} has been reviewed and the case has been resolved.`,
          link: `/dashboard/catalog/${modCase.targetEntityId}`,
        })
      }
    }
  }

  revalidatePath('/dashboard/moderation')
  return { success: true }
}

export async function assignModerationCase(
  caseId: string,
  assignedTo: string,
): Promise<{ success: boolean }> {
  const ctx = await resolveOrgContext()

  try {
    await platformDb.execute(
      sql`UPDATE zonga_moderation_cases SET assigned_to = ${assignedTo}
      WHERE id = ${caseId} AND org_id = ${ctx.orgId}`,
    )

    revalidatePath('/dashboard/moderation')
    return { success: true }
  } catch (error) {
    logger.error('assignModerationCase failed', { error })
    return { success: false }
  }
}

/* ─── Integrity Signals ─── */

export async function listIntegritySignals(opts?: {
  targetEntityId?: string
  signalType?: string
  severity?: string
}): Promise<IntegritySignal[]> {
  const ctx = await resolveOrgContext()

  try {
    const entityFilter = opts?.targetEntityId ? sql` AND entity_id = ${opts.targetEntityId}` : sql``
    const typeFilter = opts?.signalType ? sql` AND signal_type = ${opts.signalType}` : sql``
    const severityFilter = opts?.severity ? sql` AND severity = ${opts.severity}` : sql``

    const rows = (await platformDb.execute(
      sql`SELECT
        id,
        entity_type as "entityType",
        entity_id as "targetEntityId",
        signal_type as "signalType",
        severity,
        explanation,
        metadata_json as "metadataJson",
        created_at as "createdAt"
      FROM zonga_integrity_signals
      WHERE org_id = ${ctx.orgId}
      ${entityFilter} ${typeFilter} ${severityFilter}
      ORDER BY created_at DESC
      LIMIT 200`,
    )) as unknown as { rows: IntegritySignal[] }

    return rows.rows ?? []
  } catch (error) {
    logger.error('listIntegritySignals failed', { error })
    return []
  }
}

export async function recordIntegritySignal(data: {
  entityType: string
  targetEntityId: string
  signalType: string
  severity: string
  explanation?: string
  metadata?: Record<string, unknown>
}): Promise<{ success: boolean; signalId?: string }> {
  const ctx = await resolveOrgContext()

  try {
    const [row] = (await platformDb.execute(
      sql`INSERT INTO zonga_integrity_signals (org_id, entity_type, entity_id, signal_type, severity, explanation, metadata_json)
      VALUES (${ctx.orgId}, ${data.entityType}, ${data.targetEntityId}, ${data.signalType},
        ${data.severity}, ${data.explanation ?? null},
        ${data.metadata ? JSON.stringify(data.metadata) + '::jsonb' : null})
      RETURNING id`,
    )) as unknown as [{ id: string }]

    // Auto-create moderation case for critical signals
    if (data.severity === 'critical') {
      await createModerationCase({
        entityType: data.entityType,
        targetEntityId: data.targetEntityId,
        caseType: `auto_${data.signalType}`,
        severity: 'critical',
        notes: `Auto-created from integrity signal: ${data.explanation ?? data.signalType}`,
      })
    }

    logger.info('Integrity signal recorded', { signalId: row?.id, signalType: data.signalType })
    return { success: true, signalId: row?.id }
  } catch (error) {
    logger.error('recordIntegritySignal failed', { error })
    return { success: false }
  }
}

/* ─── Stats ─── */

export async function getModerationStats(): Promise<ModerationStats> {
  const ctx = await resolveOrgContext()

  try {
    const [open] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_moderation_cases
      WHERE org_id = ${ctx.orgId} AND status IN ('open', 'under_review')`,
    )) as unknown as [{ total: number }]

    const [resolved] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_moderation_cases
      WHERE org_id = ${ctx.orgId} AND status = 'resolved'`,
    )) as unknown as [{ total: number }]

    const [pendingReview] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_moderation_cases
      WHERE org_id = ${ctx.orgId} AND status = 'open' AND assigned_to IS NULL`,
    )) as unknown as [{ total: number }]

    const [critical] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_integrity_signals
      WHERE org_id = ${ctx.orgId} AND severity = 'critical'
        AND created_at > NOW() - INTERVAL '7 days'`,
    )) as unknown as [{ total: number }]

    return {
      openCases: Number(open?.total ?? 0),
      resolvedCases: Number(resolved?.total ?? 0),
      pendingReview: Number(pendingReview?.total ?? 0),
      criticalSignals: Number(critical?.total ?? 0),
    }
  } catch (error) {
    logger.error('getModerationStats failed', { error })
    return { openCases: 0, resolvedCases: 0, pendingReview: 0, criticalSignals: 0 }
  }
}
