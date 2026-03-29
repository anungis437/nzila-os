// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Idempotency Cache Cleanup
 * POST /api/admin/idempotency-cleanup   → delete expired idempotency entries
 *
 * Designed to be called from a scheduled cron job (e.g. daily).
 * Only accessible to platform_admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

const CleanupSchema = z.object({
  dryRun: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only platform admins may trigger cleanup
  const { authorize } = await import('@nzila/os-core/policy')
  try {
    await authorize(req, {
      requiredScope: 'admin:retention' as const,
    })
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number }
    return NextResponse.json({ error: 'Forbidden' }, { status: e.statusCode ?? 403 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = CleanupSchema.safeParse(body)
  const dryRun = parsed.success ? (parsed.data.dryRun ?? false) : false

  const { cleanupExpiredIdempotencyEntries } = await import('@nzila/os-core/idempotency')
  const deletedCount = dryRun ? 0 : await cleanupExpiredIdempotencyEntries()

  return NextResponse.json({
    ok: true,
    dryRun,
    deletedCount,
    cleanedAt: new Date().toISOString(),
  })
}
