/**
 * API — /api/creators
 * GET  → list creators
 * POST → register a new creator
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { listCreators, registerCreator } from '@/lib/actions/creator-actions'

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.creators.list', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      const url = new URL(request.url)
      const page = Number(url.searchParams.get('page') ?? '1')
      const status = url.searchParams.get('status') ?? undefined
      const search = url.searchParams.get('search') ?? undefined

      const data = await listCreators({ page, status, search })
      return NextResponse.json({ ok: true, data })
    }),
  )
}

export async function POST(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.creators.register', { 'http.method': 'POST' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      try {
        const body = await request.json()
        const result = await registerCreator(body)

        if (!result.success) {
          return NextResponse.json(
            { ok: false, error: result.error ?? 'Validation failed' },
            { status: 400 },
          )
        }

        return NextResponse.json({ ok: true, data: result }, { status: 201 })
      } catch (_err) {
        return NextResponse.json(
          { ok: false, error: 'Internal server error' },
          { status: 500 },
        )
      }
    }),
  )
}
