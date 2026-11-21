import { QBO_REPORT_NAME_MAP, synchronizeQboReport } from '@/lib/services/qbo-connection-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — QBO Report Sync
 * POST /api/qbo/sync
 *
 * Body: { orgId, reportType, periodStart?, periodEnd? }
 *
 * Triggers a synchronous QBO report pull:
 *   1. Loads active connection + tokens for the entity
 *   2. Refreshes access token if needed
 *   3. Fetches the report from QBO v3 REST API
 *   4. Stores the raw JSON in Blob storage (documents pattern)
 *   5. Creates qbo_sync_runs + qbo_reports rows
 *
 * Report types: trial_balance | profit_and_loss | balance_sheet |
 *               cash_flow | aging_receivable | aging_payable | general_ledger
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireOrgAccess } from '@/lib/api-guards'

const QboSyncSchema = z.object({
  orgId: z.string().min(1),
  reportType: z.string().min(1),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const parsed = QboSyncSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'orgId and reportType required' }, { status: 400 })
  }
  const { orgId, reportType } = parsed.data

  const qboReportName = QBO_REPORT_NAME_MAP[reportType as string]
  if (!qboReportName) {
    return NextResponse.json(
      { error: `Unknown reportType. Valid: ${Object.keys(QBO_REPORT_NAME_MAP).join(', ')}` },
      { status: 400 },
    )
  }

  const access = await requireOrgAccess(orgId, { minRole: 'org_secretary' })
  if (!access.ok) return access.response

  const result = await synchronizeQboReport(parsed.data, qboReportName)
  return NextResponse.json(result.body, { status: result.status })
}
