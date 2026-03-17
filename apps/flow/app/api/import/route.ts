import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { importLegacyRecordsAction, validateLegacyDataAction } from '@/lib/actions'

/**
 * POST /api/import — import legacy ShopMoiÇa records.
 * PUT  /api/import — validate legacy records (dry-run).
 */

export async function POST(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.import.execute', { 'http.method': 'POST' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response
      try {
        const body = await request.json()
        if (!Array.isArray(body)) {
          return NextResponse.json(
            { ok: false, error: 'Request body must be a JSON array' },
            { status: 400 },
          )
        }
        const result = await importLegacyRecordsAction(body)
        return NextResponse.json(result)
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
          { status: 500 },
        )
      }
    }),
  )
}

export async function PUT(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.import.validate', { 'http.method': 'PUT' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response
      try {
        const body = await request.json()
        if (!Array.isArray(body)) {
          return NextResponse.json(
            { ok: false, error: 'Request body must be a JSON array' },
            { status: 400 },
          )
        }
        const result = await validateLegacyDataAction(body)
        return NextResponse.json(result)
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
          { status: 500 },
        )
      }
    }),
  )
}
