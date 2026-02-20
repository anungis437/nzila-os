import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only compliance officers and super admins may trigger retention enforcement
  // Role check is done via the policy engine
  const { authorize } = await import('@nzila/os-core/policy')
  try {
    await authorize(req, {
      requiredScopes: ['admin:retention:run'],
      actorClerkId: userId,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode ?? 403 })
  }

  const body = await req.json().catch(() => ({}))
  const dryRun = body.dryRun === true
  const limit = typeof body.limit === 'number' ? body.limit : 500

  const { enforceRetention } = await import('@nzila/os-core/retention')
  const result = await enforceRetention({
    actorId: userId,
    dryRun,
    limit,
  })

  return NextResponse.json(result)
}
