/**
 * API — Evidence Packs
 * GET /api/evidence-packs — list evidence packs from DB
 *
 * Supports ?download=true for JSON file export.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformRole, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { platformDb } from '@nzila/db/platform'
import { evidencePacks } from '@nzila/db/schema'
import { desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  return withRequestContext(req, () =>
    withSpan('api.evidence-packs.list', {}, async () => {
      const auth = await requirePlatformRole('platform_admin', 'studio_admin')
      if (!auth.ok) return auth.response

      const packs = await platformDb
        .select()
        .from(evidencePacks)
        .orderBy(desc(evidencePacks.createdAt))

      if (req.nextUrl.searchParams.get('download') === 'true') {
        return new NextResponse(JSON.stringify(packs, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="evidence-packs-${new Date().toISOString().slice(0, 10)}.json"`,
          },
        })
      }

      return NextResponse.json(packs)
    }),
  )
}
