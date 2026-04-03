/**
 * API — /api/catalog
 * GET  → list content assets (catalog)
 * POST → create a new content asset
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { listCatalogAssets, createContentAsset } from '@/lib/actions/catalog-actions'

export async function GET(request: Request) {
  return withOrgScope(request, () =>
    withSpan('api.catalog.list', { 'http.method': 'GET' }, async () => {
      const url = new URL(request.url)
      const page = Number(url.searchParams.get('page') ?? '1')
      const search = url.searchParams.get('search') ?? undefined
      const type = url.searchParams.get('type') ?? undefined
      const status = url.searchParams.get('status') ?? undefined

      const data = await listCatalogAssets({ page, search, type, status })
      return NextResponse.json({ ok: true, data })
    }),
  )
}

export async function POST(request: Request) {
  return withOrgScope(request, () =>
    withSpan('api.catalog.create', { 'http.method': 'POST' }, async () => {
      try {
        const body = await request.json()
        const result = await createContentAsset(body)

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
