import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/api-authorization'
import { getMetricsSummary } from '@/lib/maestria-monitoring'

export async function GET(req: NextRequest) {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams)
  const auth = authorize(searchParams, 'module.internal.view', 'metrics.read', 'maestria:metrics')
  if (auth.response) return auth.response
  return NextResponse.json(getMetricsSummary(), { status: 200 })
}
