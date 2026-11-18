/** Existing report creation/read/export with one verified tenant/resource context. */
'use server'
import { resolveOrgContext } from '@/lib/resolve-org'
import {
  generateScopedReport,
  listReportsForContext,
  reportNarrative,
  exportReports,
  type Report,
  type ReportListResult,
} from '@/lib/services/reports'
export type { Report, ReportListResult } from '@/lib/services/reports'
export async function listReports(opts?: {
  page?: number
  pageSize?: number
  type?: string
  status?: string
}): Promise<ReportListResult> {
  return resolveOrgContext('resource', { permission: 'reports:view' }, (context) =>
    listReportsForContext(context, opts),
  )
}
export async function generateReport(input: {
  type: Report['type']
  period: string
  orgId?: string
  includeNarrative?: boolean
}) {
  return resolveOrgContext(
    'organization',
    { permission: 'reports:create', organizationId: input?.orgId },
    (context) => generateScopedReport(context, input),
  )
}
export async function getReportNarrative(reportId: string): Promise<string | null> {
  return resolveOrgContext('resource', { permission: 'reports:view' }, (context) =>
    reportNarrative(context, reportId),
  )
}
export async function getReportExportUrl(opts: {
  reportId?: string
  format: 'csv' | 'pdf'
}): Promise<string> {
  return resolveOrgContext('resource', { permission: 'reports:export' }, async (context) => {
    if (!['csv', 'pdf'].includes(opts.format)) throw new Error('Invalid report format')
    // The URL is a convenience only; the download handler resolves authority again.
    await exportReports(context, opts.reportId)
    const params = new URLSearchParams({ format: opts.format })
    if (opts.reportId) params.set('reportId', opts.reportId)
    return `/api/reports/export?${params.toString()}`
  })
}
