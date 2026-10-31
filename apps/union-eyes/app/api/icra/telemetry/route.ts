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
 * Anti-surveillance: no PII accepted. Metadata keys and values are allowlisted and
 * length-capped. Request bodies are streamed with a strict size bound. Rate limited per IP. Silent 204 on success.
 */

import { NextRequest, NextResponse } from 'next/server'
import { clientAddress } from '@/lib/public-intake/guard';
import { fireAndForgetEvent, hashIp, type IcraEventKind } from '@/lib/icra/observability'
import { checkRateLimit } from '@/lib/rate-limiter'

const ALLOWED_KINDS: ReadonlySet<IcraEventKind> = new Set<IcraEventKind>([
  'assessment_started',
  'consent_accepted',
  'org_context_completed',
  'section_advanced',
  'section_completed',
  'section_abandoned',
  'assessment_resumed',
  'adaptive_profile_created',
  'assessment_routed',
  'adaptive_question_deferred',
])

const MAX_METADATA_KEYS = 8
const MAX_METADATA_VALUE_LEN = 64
const MAX_BODY_BYTES = 4096

// Only coarse operational categories may leave the public assessment. In particular, free-text identifiers,
// question IDs, organization names, contact details and client-supplied fingerprints are not telemetry.
const SAFE_SECTIONS = new Set([
  'org_context', 'governance', 'operational_dependency', 'governance_visibility',
  'institutional_memory', 'transition_readiness', 'operational_coordination',
  'explainability_trust', 'sovereignty_governance',
])
const NUMERIC_METADATA = new Set(['step', 'answered', 'included', 'deferred', 'required', 'optional'])
const TOKEN_METADATA = new Set(['doctrineVersion', 'scale', 'continuity', 'governance', 'routeVersion', 'decision', 'ruleId'])
const SAFE_TOKEN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/

async function boundedJson(request: NextRequest): Promise<unknown> {
  if (!request.body) return null
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    const data = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      data.set(chunk, offset)
      offset += chunk.byteLength
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data))
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
}

interface TelemetryBody {
  kind: IcraEventKind
  sectionId?: string
  metadata?: Record<string, string | number | boolean>
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Generous limit — flow emits roughly 1 event per section transition.
  // Telemetry is best effort: a refusal or an unavailable limiter drops the event silently.
  let allowed = false
  try {
    const rl = await checkRateLimit(`icra-telemetry:${clientAddress(req)}`, {
      limit: 60,
      window: 60,
      identifier: 'icra-telemetry',
      failOpen: false,
    })
    allowed = rl.allowed
  } catch {
    // Observability must not emit when its limiter cannot establish a quota.
    return new NextResponse(null, { status: 204 })
  }
  if (!allowed) {
    return new NextResponse(null, { status: 204 })
  }

  const body = await boundedJson(req)
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return new NextResponse(null, { status: 204 })
  }

  const raw = body as Record<string, unknown>
  const kind = typeof raw.kind === 'string' ? (raw.kind as IcraEventKind) : null
  if (!kind || !ALLOWED_KINDS.has(kind)) {
    return new NextResponse(null, { status: 204 })
  }

  const sectionId =
    typeof raw.sectionId === 'string' && SAFE_SECTIONS.has(raw.sectionId)
      ? raw.sectionId
      : undefined

  let metadata: TelemetryBody['metadata']
  if (raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)) {
    const entries: Array<[string, string | number | boolean]> = []
    for (const [k, v] of Object.entries(raw.metadata as Record<string, unknown>)) {
      if (entries.length >= MAX_METADATA_KEYS) break
      if (NUMERIC_METADATA.has(k) && typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100000) {
        entries.push([k, v])
      } else if (TOKEN_METADATA.has(k) && typeof v === 'string' && v.length <= MAX_METADATA_VALUE_LEN && SAFE_TOKEN.test(v)) {
        entries.push([k, v])
      }
    }
    if (entries.length > 0) metadata = Object.fromEntries(entries)
  }

  const ip = clientAddress(req)
  fireAndForgetEvent({
    kind,
    sectionId,
    metadata,
    ipHash: hashIp(ip),
  })

  return new NextResponse(null, { status: 204 })
}
