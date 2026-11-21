import { readMemberCostRollups } from '@/lib/services/portfolio-overview-service'
import { NextResponse } from 'next/server'

import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.cost.rollup.get', { 'http.method': 'GET' }, async () => {
      try {
        const authResult = await authenticateUser()
        if (!authResult.ok) return authResult.response

        const { userId } = authResult
        const result = await readMemberCostRollups(userId)
        return NextResponse.json(result.body, { status: result.status })
      } catch {
        return NextResponse.json({ rollups: [] })
      }
    }),
  )
}
