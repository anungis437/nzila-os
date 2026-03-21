/**
 * Zonga Server Actions — Compliance & Audit Exports.
 *
 * Label-only feature (S2 guard: compliance_exports).
 * Generates CSV/JSON compliance reports for audit trails,
 * revenue events, royalty splits, and moderation history.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { getCreatorPlan } from '@/lib/guards/plan-queries'
import { guardCreatorFeature } from '@/lib/guards/subscription-guards'

export type ExportFormat = 'json' | 'csv'
export type ExportType = 'revenue' | 'royalties' | 'audit_trail' | 'moderation'

export interface ExportResult {
  ok: boolean
  data?: string
  format?: ExportFormat
  type?: ExportType
  rowCount?: number
  error?: string
}

/**
 * Generate a compliance export for the given creator's data.
 * Gated by S2: compliance_exports feature requires label plan.
 */
export async function generateComplianceExport(opts: {
  creatorId: string
  type: ExportType
  format?: ExportFormat
  startDate?: string
  endDate?: string
}): Promise<ExportResult> {
  const ctx = await resolveOrgContext()
  const format = opts.format ?? 'json'

  // S2: compliance exports require label plan
  const planInfo = await getCreatorPlan(opts.creatorId, ctx.orgId)
  const guard = guardCreatorFeature(planInfo.plan, 'compliance_exports')
  if (!guard.passed) {
    return { ok: false, error: guard.details ?? 'Label plan required for compliance exports' }
  }

  try {
    const dateStart = opts.startDate ?? '1970-01-01'
    const dateEnd = opts.endDate ?? new Date().toISOString().split('T')[0]

    let rows: Record<string, unknown>[] = []

    switch (opts.type) {
      case 'revenue':
        rows = await queryRevenueExport(ctx.orgId, opts.creatorId, dateStart, dateEnd)
        break
      case 'royalties':
        rows = await queryRoyaltyExport(ctx.orgId, opts.creatorId, dateStart, dateEnd)
        break
      case 'audit_trail':
        rows = await queryAuditExport(ctx.orgId, opts.creatorId, dateStart, dateEnd)
        break
      case 'moderation':
        rows = await queryModerationExport(ctx.orgId, opts.creatorId, dateStart, dateEnd)
        break
    }

    // Record the export in audit log
    await platformDb.execute(
      sql`INSERT INTO audit_log (entity_id, actor_id, action, metadata, org_id)
      VALUES (${opts.creatorId}, ${ctx.actorId}, 'compliance.export',
        ${JSON.stringify({ type: opts.type, format, rowCount: rows.length, dateRange: [dateStart, dateEnd] })}::jsonb,
        ${ctx.orgId})`,
    )

    const data = format === 'csv' ? toCsv(rows) : JSON.stringify(rows, null, 2)

    logger.info('Compliance export generated', {
      creatorId: opts.creatorId,
      type: opts.type,
      format,
      rowCount: rows.length,
    })

    return { ok: true, data, format, type: opts.type, rowCount: rows.length }
  } catch (error) {
    logger.error('generateComplianceExport failed', { error })
    return { ok: false, error: 'Export generation failed' }
  }
}

/* ─── Query Helpers ─── */

async function queryRevenueExport(
  orgId: string, creatorId: string, startDate: string, endDate: string,
): Promise<Record<string, unknown>[]> {
  const result = (await platformDb.execute(
    sql`SELECT
      re.id, re.event_type as "eventType", re.amount_cents as "amountCents",
      re.currency, re.source_type as "sourceType", re.created_at as "createdAt",
      ca.title as "assetTitle"
    FROM zonga_revenue_events re
    LEFT JOIN zonga_content_assets ca ON ca.id = re.asset_id
    WHERE re.org_id = ${orgId} AND re.creator_id = ${creatorId}
      AND re.created_at >= ${startDate}::date AND re.created_at <= ${endDate}::date + interval '1 day'
    ORDER BY re.created_at DESC`,
  )) as unknown as { rows: Record<string, unknown>[] }

  return result.rows ?? []
}

async function queryRoyaltyExport(
  orgId: string, creatorId: string, startDate: string, endDate: string,
): Promise<Record<string, unknown>[]> {
  const result = (await platformDb.execute(
    sql`SELECT
      rs.id, rs.release_id as "releaseId", rs.payee_creator_id as "payeeCreatorId",
      rs.share_percent as "sharePercent", rs.role, rs.created_at as "createdAt",
      r.title as "releaseTitle"
    FROM zonga_royalty_splits rs
    LEFT JOIN zonga_releases r ON r.id = rs.release_id
    WHERE rs.org_id = ${orgId}
      AND (rs.payee_creator_id = ${creatorId} OR rs.release_id IN (
        SELECT id FROM zonga_releases WHERE creator_id = ${creatorId} AND org_id = ${orgId}
      ))
      AND rs.created_at >= ${startDate}::date AND rs.created_at <= ${endDate}::date + interval '1 day'
    ORDER BY rs.created_at DESC`,
  )) as unknown as { rows: Record<string, unknown>[] }

  return result.rows ?? []
}

async function queryAuditExport(
  orgId: string, creatorId: string, startDate: string, endDate: string,
): Promise<Record<string, unknown>[]> {
  const result = (await platformDb.execute(
    sql`SELECT
      al.id, al.action, al.actor_id as "actorId", al.entity_id as "entityId",
      al.metadata, al.created_at as "createdAt"
    FROM audit_log al
    WHERE al.org_id = ${orgId}
      AND (al.entity_id = ${creatorId} OR al.actor_id = ${creatorId})
      AND al.created_at >= ${startDate}::date AND al.created_at <= ${endDate}::date + interval '1 day'
    ORDER BY al.created_at DESC`,
  )) as unknown as { rows: Record<string, unknown>[] }

  return result.rows ?? []
}

async function queryModerationExport(
  orgId: string, creatorId: string, startDate: string, endDate: string,
): Promise<Record<string, unknown>[]> {
  const result = (await platformDb.execute(
    sql`SELECT
      mc.id, mc.case_type as "caseType", mc.status, mc.severity,
      mc.asset_id as "assetId", mc.resolved_at as "resolvedAt",
      mc.created_at as "createdAt", ca.title as "assetTitle"
    FROM zonga_moderation_cases mc
    LEFT JOIN zonga_content_assets ca ON ca.id = mc.asset_id
    WHERE mc.org_id = ${orgId}
      AND mc.asset_id IN (SELECT id FROM zonga_content_assets WHERE creator_id = ${creatorId} AND org_id = ${orgId})
      AND mc.created_at >= ${startDate}::date AND mc.created_at <= ${endDate}::date + interval '1 day'
    ORDER BY mc.created_at DESC`,
  )) as unknown as { rows: Record<string, unknown>[] }

  return result.rows ?? []
}

/* ─── CSV Formatter ─── */

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''

  const headers = Object.keys(rows[0]!)
  const lines = [headers.join(',')]

  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h]
      if (val == null) return ''
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
      // Escape CSV values containing commas, quotes, or newlines
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    })
    lines.push(values.join(','))
  }

  return lines.join('\n')
}
