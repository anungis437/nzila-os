import { NextRequest, NextResponse } from 'next/server'
import { authorizeRequest } from '@/lib/api-authorization'
import { createOperationalRecord, listOperationalRecords, type RecordType } from '@/lib/maestria-persistence'
import { recordOperationalEvent } from '@/lib/maestria-analytics'

function parseRecordType(input: string | null): RecordType | undefined {
  if (!input) return undefined
  if (input === 'quote' || input === 'comment' || input === 'task' || input === 'proposal') return input
  return undefined
}

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = authorizeRequest(searchParams, 'module.internal.view', 'ops.records.read', 'ops:records')
  if (auth.response) return auth.response

  const type = parseRecordType(request.nextUrl.searchParams.get('type'))
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '50')

  return NextResponse.json({
    ok: true,
    records: listOperationalRecords(type, Number.isFinite(limit) ? Math.max(1, Math.min(limit, 200)) : 50),
  })
}

export async function POST(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = authorizeRequest(searchParams, 'quote.manage', 'ops.records.create', 'ops:records')
  if (auth.response) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>
  const type = parseRecordType(typeof raw.type === 'string' ? raw.type : null)
  if (!type || typeof raw.title !== 'string' || typeof raw.body !== 'string') {
    return NextResponse.json({ ok: false, error: 'missing_required_fields' }, { status: 400 })
  }

  const created = createOperationalRecord({
    type,
    title: raw.title,
    body: raw.body,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    priority: typeof raw.priority === 'string' ? raw.priority : undefined,
    createdBy: auth.actor.displayName,
    payload: raw.payload && typeof raw.payload === 'object' ? (raw.payload as Record<string, unknown>) : {},
  })

  recordOperationalEvent({
    eventName: `${type}.created`,
    value: 1,
    unit: 'count',
    source: 'maestria.ops.records',
    dimensions: { actor: auth.actor.id, role: auth.actor.role },
  })

  return NextResponse.json({ ok: true, record: created }, { status: 201 })
}
