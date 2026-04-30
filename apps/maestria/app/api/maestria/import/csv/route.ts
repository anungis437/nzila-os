import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/api-authorization'

const requireOrgAccess = authorize
import { parseMaestriaCsv } from '@/lib/maestria-csv-import'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = requireOrgAccess(searchParams, 'shopify.view', 'csv-import', 'product')
  if (auth.response) return auth.response

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('text/csv') && !contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Expected Content-Type: text/csv or multipart/form-data' },
      { status: 415 },
    )
  }

  let csvText: string
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'Missing "file" field in form data' }, { status: 400 })
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `File exceeds maximum size of ${MAX_BYTES / 1024 / 1024} MB` },
          { status: 413 },
        )
      }
      csvText = await file.text()
    } else {
      const bytes = await request.arrayBuffer()
      if (bytes.byteLength > MAX_BYTES) {
        return NextResponse.json(
          { error: `Body exceeds maximum size of ${MAX_BYTES / 1024 / 1024} MB` },
          { status: 413 },
        )
      }
      csvText = new TextDecoder().decode(bytes)
    }
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 })
  }

  const result = parseMaestriaCsv(csvText)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({
    imported: result.rows.length,
    skipped: result.skipped,
    warnings: result.warnings,
    rows: result.rows,
  })
}
