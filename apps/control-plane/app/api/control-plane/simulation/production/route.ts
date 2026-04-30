import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { runSyntheticProductionSimulation } from '@/server/simulation-runner'
import { refreshPolicyPerformance } from '@/server/policy-performance-data'

const RequestSchema = z.object({
  requestCount: z.number().int().min(10_000).max(100_000).default(25_000),
  days: z.number().int().min(7).max(180).default(90),
  orgCount: z.number().int().min(100).max(300).default(100),
  policyCasesPerDomain: z.number().int().min(50).max(100).default(75),
})

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request)
    const payload = RequestSchema.parse(await request.json().catch(() => ({})))

    const simulation = await runSyntheticProductionSimulation({
      requestCount: payload.requestCount,
      days: payload.days,
      orgCount: payload.orgCount,
    })

    const policyPerformance = refreshPolicyPerformance(payload.policyCasesPerDomain)

    return NextResponse.json({
      ok: true,
      data: {
        simulation,
        policyPerformance,
      },
    })
  } catch (error) {
    return handleAuthError(error)
  }
}
