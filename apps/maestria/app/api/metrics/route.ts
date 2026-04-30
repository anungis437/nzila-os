import { NextRequest, NextResponse } from 'next/server'
import { resolveActor, hasPermission } from '@/lib/access-control'
import { getMetricsSummary } from '@/lib/maestria-monitoring'

export async function GET(req: NextRequest) {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams)
  const actor = resolveActor(searchParams)
  if (!hasPermission(actor, 'module.internal.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(getMetricsSummary(), { status: 200 })
}
