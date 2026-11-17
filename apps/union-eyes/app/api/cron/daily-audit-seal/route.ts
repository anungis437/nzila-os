import { withApi } from '@/lib/api/framework'
import { runDailyAuditSeals } from '@/lib/audit/daily-audit-seal-runtime'
import { jobResponse } from '@/lib/operations/job-result'
import { readinessPolicy } from '@/lib/operations/readiness-policy'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
export const POST = withApi({ auth: { cron: true }, openapi: {
  tags: ['Cron', 'Audit'], summary: 'Verify audit history and persist one keyed checkpoint per UTC day',
} }, async () => {
  if (readinessPolicy().profile !== 'union-eyes-v2-base') return NextResponse.json({ error: 'Base operational profile required' }, { status: 503 })
  return jobResponse(await runDailyAuditSeals())
})
