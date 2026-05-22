/**
 * ARTIFACT TYPE: API Route
 * DOCTRINE_VERSION: 1.0.0
 *
 * POST /api/icra/telemetry
 *
 * Client-side abandonment + flow instrumentation sink. Accepts a tightly
 * bounded event payload from the assessment flow and forwards it to the
 * existing trackIcraEvent pipeline. Designed to be called via
 * navigator.sendBeacon for unload-time abandonment signals.
 *
 * Anti-surveillance: no PII accepted. Metadata values are coerced and
 * length-capped. Rate limited per IP. Silent 204 on success.
 */

import { NextRequest, NextResponse } from 'next/server'
import { fireAndForgetEvent, hashIp, type IcraEventKind } from '@/lib/icra/observability'
import { rateLimit } from '@/lib/rate-limit'

const ALLOWED_KINDS: ReadonlySet<IcraEventKind> = new Set<IcraEventKind>([
  'assessment_started',
  'consent_accepted',
  'org_context_completed',
  'section_advanced',
  'section_completed',
  'section_abandoned',
  'assessment_resumed',
])

const MAX_METADATA_KEYS = 8
const MAX_METADATA_VALUE_LEN = 64
const MAX_SECTION_ID_LEN = 64

interface TelemetryBody {
  kind: IcraEventKind
  sectionId?: string
  metadata?: Record<string, string | number | boolean>
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Generous limit — flow emits roughly 1 event per section transition.
  const rl = rateLimit(req, { maxRequests: 60, windowSeconds: 60 })
  if (!rl.success) {
    return new NextResponse(null, { status: 204 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  if (typeof body !== 'object' || body === null) {
    return new NextResponse(null, { status: 204 })
  }

  const raw = body as Record<string, unknown>
  const kind = typeof raw.kind === 'string' ? (raw.kind as IcraEventKind) : null
  if (!kind || !ALLOWED_KINDS.has(kind)) {
    return new NextResponse(null, { status: 204 })
  }

  const sectionId =
    typeof raw.sectionId === 'string' && raw.sectionId.length <= MAX_SECTION_ID_LEN
      ? raw.sectionId
      : undefined

  let metadata: TelemetryBody['metadata']
  if (raw.metadata && typeof raw.metadata === 'object') {
    const entries: Array<[string, string | number | boolean]> = []
    for (const [k, v] of Object.entries(raw.metadata as Record<string, unknown>)) {
      if (entries.length >= MAX_METADATA_KEYS) break
      if (k.length > MAX_METADATA_VALUE_LEN) continue
      if (typeof v === 'string') {
        entries.push([k, v.slice(0, MAX_METADATA_VALUE_LEN)])
      } else if (typeof v === 'number' && Number.isFinite(v)) {
        entries.push([k, v])
      } else if (typeof v === 'boolean') {
        entries.push([k, v])
      }
    }
    if (entries.length > 0) metadata = Object.fromEntries(entries)
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  fireAndForgetEvent({
    kind,
    sectionId,
    metadata,
    ipHash: hashIp(ip),
  })

  return new NextResponse(null, { status: 204 })
}
