// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'

const RetentionRunSchema = z.object({
  dryRun: z.boolean().optional(),
  limit: z.number().int().positive().optional(),
})

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
      requiredScope: 'admin:retention' as const,
    })
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number }
    return NextResponse.json({ error: e.message ?? 'Forbidden' }, { status: e.statusCode ?? 403 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = RetentionRunSchema.safeParse(body)
  const dryRun = parsed.success ? (parsed.data.dryRun ?? false) : false
  const limit = parsed.success ? (parsed.data.limit ?? 500) : 500

  const { enforceRetention } = await import('@nzila/os-core/retention')
  const result = await enforceRetention({
    actorId: userId,
    dryRun,
    limit,
  })

  return NextResponse.json(result)
}
