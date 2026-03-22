/**
 * API — /api/clients
 * GET  → list clients with pagination + search
 * POST → create a new client
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { listClients, createClient } from '@/lib/actions/client-actions'
import { ClientSchema } from '@/domain'

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.clients.list', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      const url = new URL(request.url)
      const page = Number(url.searchParams.get('page') ?? '1')
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20')
      const search = url.searchParams.get('search') ?? undefined
      const status = url.searchParams.get('status') ?? undefined

      const data = await listClients({ page, pageSize, search, status })
      return NextResponse.json({ ok: true, data })
    }),
  )
}

export async function POST(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.clients.create', { 'http.method': 'POST' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      try {
        const body = await request.json()
        const parsed = ClientSchema.omit({ id: true }).safeParse(body)
        if (!parsed.success) {
          return NextResponse.json(
            { ok: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
            { status: 400 },
          )
        }
        const result = await createClient(parsed.data)

        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error ?? 'Validation failed' },
            { status: 400 },
          )
        }

        return NextResponse.json({ ok: true, data: result }, { status: 201 })
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
          { status: 500 },
        )
      }
    }),
  )
}
