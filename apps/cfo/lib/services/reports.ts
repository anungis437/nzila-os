import { z } from 'zod'
import { buildCanonicalAiOutput, type CanonicalAiOutput } from '@nzila/ai-sdk'
import { runAICompletionDetailed } from '@/lib/ai-client'
import { assertCfoContextPermission, type CfoActionContext } from '@/lib/resolve-org'
import { createCfoRecord, getCfoRecord, listCfoRecords, type CfoRecord } from './cfo-records'
const reportType = z.enum([
  'pnl',
  'balance-sheet',
  'cash-flow',
  'tax-summary',
  'audit-trail',
  'custom',
])
const status = z.enum(['draft', 'generated', 'reviewed', 'published'])
const reportInput = z
  .object({
    type: reportType,
    period: z.string().min(1),
    orgId: z.string().optional(),
    includeNarrative: z.boolean().optional(),
  })
  .strict()
export interface Report {
  id: string
  title: string
  type: z.infer<typeof reportType>
  status: z.infer<typeof status>
  period: string
  createdAt: Date
  generatedBy: string
  narrativeSummary: string | null
}
export interface ReportListResult {
  reports: Report[]
  total: number
}
function projection(row: CfoRecord): Report {
  const m = z
    .object({
      title: z.string(),
      type: reportType,
      status,
      period: z.string(),
      narrative: z.string().nullable().optional(),
    })
    .parse(row.metadata)
  return {
    id: row.id,
    title: m.title,
    type: m.type,
    status: m.status,
    period: m.period,
    createdAt: row.createdAt,
    generatedBy: row.actorId,
    narrativeSummary: m.narrative ?? null,
  }
}
async function all(context: CfoActionContext) {
  return (
    await Promise.all([
      listCfoRecords(context, 'report.generated'),
      listCfoRecords(context, 'report.created'),
    ])
  )
    .flat()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
}
export async function listReportsForContext(
  context: CfoActionContext,
  options?: { page?: number; pageSize?: number; type?: string; status?: string },
): Promise<ReportListResult> {
  const opts = z
    .object({
      page: z.number().int().positive().optional(),
      pageSize: z.number().int().min(1).max(500).optional(),
      type: reportType.optional(),
      status: status.optional(),
    })
    .strict()
    .parse(options ?? {})
  const rows = (await all(context))
    .map(projection)
    .filter(
      (r) => (!opts.type || r.type === opts.type) && (!opts.status || r.status === opts.status),
    )
  const offset = ((opts.page ?? 1) - 1) * (opts.pageSize ?? 20)
  return { reports: rows.slice(offset, offset + (opts.pageSize ?? 20)), total: rows.length }
}
export async function generateScopedReport(
  context: CfoActionContext,
  input: z.input<typeof reportInput>,
): Promise<CanonicalAiOutput<{ success: boolean; reportId?: string; narrative?: string }>> {
  assertCfoContextPermission(context, 'reports:create')
  if (context.purpose !== 'organization') throw new Error('Verified report organization required')
  const value = reportInput.parse(input)
  let narrative: string | undefined,
    execution = { modelUsed: 'report-generator', engineVersion: 'finance:report-generator' }
  if (value.includeNarrative) {
    const result = await runAICompletionDetailed(
      `Generate a concise executive summary for a ${value.type} financial report covering the period ${value.period}. Focus on key trends, notable changes, and actionable insights. Keep it under 300 words. Professional tone suitable for CFO-level review.`,
      { orgId: context.organizationId, profile: 'cfo-default', dataClass: 'sensitive' },
    )
    execution = result.execution
    narrative = result.content ?? ''
  }
  const row = await createCfoRecord(context, {
    action: 'report.generated',
    metadata: {
      title: `${value.type.replace('-', ' ').toUpperCase()} — ${value.period}`,
      type: value.type,
      status: narrative ? 'generated' : 'draft',
      period: value.period,
      narrative: narrative ?? null,
    },
  })
  // The actual mandatory primary event was committed with the report root;
  // no unrelated best-effort evidence service can certify this transaction.
  return buildCanonicalAiOutput({
    payload: { success: true, reportId: row.id, narrative },
    appKey: 'cfo',
    orgId: context.organizationId,
    execution,
    confidenceScore: value.includeNarrative ? 0.72 : 1,
    evidenceRefs: [`audit_log:${row.id}`],
    domain: 'finance',
  })
}
export async function reportNarrative(context: CfoActionContext, id: string) {
  const row = await getCfoRecord(context, id, ['report.generated', 'report.created'])
  return row ? projection(row).narrativeSummary : null
}
export interface ExportReport {
  id: string
  title: string
  type: string
  status: string
  period: string
  createdAt: string
  generatedBy: string
  narrative: string | null
  orgId: string | null
}
export async function exportReports(
  context: CfoActionContext,
  id?: string,
): Promise<ExportReport[]> {
  assertCfoContextPermission(context, 'reports:export')
  const records = id
    ? [await getCfoRecord(context, id, ['report.generated', 'report.created'])].filter(
        (r): r is CfoRecord => r !== null,
      )
    : await all(context)
  return records.slice(0, 500).map((row) => {
    const p = projection(row)
    return {
      id: p.id,
      title: p.title,
      type: p.type,
      status: p.status,
      period: p.period,
      createdAt: p.createdAt.toISOString(),
      generatedBy: p.generatedBy,
      narrative: p.narrativeSummary,
      orgId: row.organizationId,
    }
  })
}
