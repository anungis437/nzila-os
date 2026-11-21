import { readPortfolioAnalytics } from '@/lib/services/portfolio-overview-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Analytics Overview
 * GET /api/analytics   → portfolio-level analytics powered by HyperLogLog
 *
 * Computes cardinality estimates across orgs: unique shareholders,
 * unique people, document counts, action counts, audit chain stats.
 */
import { NextResponse } from 'next/server'

import { authenticateUser } from '@/lib/api-guards'

export async function GET() {
  try {
    const authResult = await authenticateUser()
    if (!authResult.ok) return authResult.response
    const { userId } = authResult

    const result = await readPortfolioAnalytics(userId)
    return NextResponse.json(result.body, { status: result.status })
  } catch {
    return NextResponse.json({
      orgs: 0,
      uniqueShareholders: { count: 0, precision: 0, standardError: 0 },
      uniquePeople: { count: 0, precision: 0, standardError: 0 },
      totalDocuments: 0,
      totalActions: 0,
      totalAuditEvents: 0,
      totalLedgerEntries: 0,
      totalResolutions: 0,
      totalMeetings: 0,
      entityBreakdown: [],
    })
  }
}
