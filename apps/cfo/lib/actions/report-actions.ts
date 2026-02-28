/**
 * CFO Server Actions — Reports.
 *
 * Financial report generation, listing, and AI-powered narrative
 * summaries using @nzila/ai-sdk.
 */
'use server'

import { auth } from '@clerk/nextjs/server'
import { requirePermission } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { runAICompletion } from '@/lib/ai-client'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

export interface Report {
  id: string
  title: string
  type: 'pnl' | 'balance-sheet' | 'cash-flow' | 'tax-summary' | 'audit-trail' | 'custom'
  status: 'draft' | 'generated' | 'reviewed' | 'published'
  period: string
  createdAt: Date
  generatedBy: string
  narrativeSummary: string | null
}

export interface ReportListResult {
  reports: Report[]
  total: number
}

export async function listReports(opts?: {
  page?: number
  pageSize?: number
  type?: string
  status?: string
}): Promise<ReportListResult> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('reports:view')

  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 20
  const offset = (page - 1) * pageSize

  try {
    const reports = (await platformDb.execute(
      sql`SELECT
        id, metadata->>'title' as title,
        metadata->>'type' as type,
        metadata->>'status' as status,
        metadata->>'period' as period,
        created_at as "createdAt",
        actor_id as "generatedBy",
        metadata->>'narrative' as "narrativeSummary"
      FROM audit_log
      WHERE action = 'report.generated' OR action = 'report.created'
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
    )) as unknown as { rows: Report[] }

    const [countResult] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM audit_log
      WHERE action = 'report.generated' OR action = 'report.created'`,
    )) as unknown as [{ total: number }]

    return {
      reports: reports.rows ?? [],
      total: Number(countResult?.total ?? 0),
    }
  } catch (error) {
    logger.error('Failed to list reports', { error })
    return { reports: [], total: 0 }
  }
}

export async function generateReport(input: {
  type: Report['type']
  period: string
  entityId?: string
  includeNarrative?: boolean
}): Promise<{ success: boolean; reportId?: string; narrative?: string }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('reports:create')

  try {
    logger.info('Generating financial report', { type: input.type, period: input.period, actorId: userId })

    let narrative: string | undefined
    if (input.includeNarrative) {
      const prompt = `Generate a concise executive summary for a ${input.type} financial report
        covering the period ${input.period}. Focus on key trends, notable changes, and actionable insights.
        Keep it under 300 words. Professional tone suitable for CFO-level review.`
      const result = await runAICompletion(prompt)
      narrative = result ?? ''
    }

    // Record in audit log as report generation
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, metadata)
      VALUES (
        'report.generated',
        ${userId},
        'report',
        gen_random_uuid()::text,
        ${JSON.stringify({
          title: `${input.type.replace('-', ' ').toUpperCase()} — ${input.period}`,
          type: input.type,
          status: narrative ? 'generated' : 'draft',
          period: input.period,
          narrative: narrative ?? null,
          entityId: input.entityId ?? null,
        })}::jsonb
      )`,
    )

    const pack = buildEvidencePackFromAction({
      actionId: `report-${Date.now()}`,
      actionType: 'REPORT_GENERATED',
      entityId: input.entityId ?? 'platform',
      executedBy: userId,
    })
    await processEvidencePack(pack)

    logger.info('Report generated', { type: input.type, period: input.period })
    return { success: true, narrative }
  } catch (error) {
    logger.error('Report generation failed', { error })
    return { success: false }
  }
}

export async function getReportNarrative(reportId: string): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('reports:view')

  try {
    const [row] = (await platformDb.execute(
      sql`SELECT metadata->>'narrative' as narrative FROM audit_log WHERE id = ${reportId}`,
    )) as unknown as [{ narrative: string | null }]
    return row?.narrative ?? null
  } catch {
    return null
  }
}

/**
 * Build the export URL for client-side download.
 * The actual export is handled by the /api/reports/export route.
 */
export async function getReportExportUrl(opts: {
  reportId?: string
  format: 'csv' | 'pdf'
}): Promise<string> {
  const params = new URLSearchParams({ format: opts.format })
  if (opts.reportId) params.set('reportId', opts.reportId)
  return `/api/reports/export?${params.toString()}`
}
