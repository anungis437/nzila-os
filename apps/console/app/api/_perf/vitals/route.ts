/**
 * Web Vitals beacon endpoint.
 *
 * Accepts small JSON payloads from the in-page reporter (sendBeacon).
 * Validates shape, drops anything outside the allowed metric set,
 * and writes to the in-process ring buffer consumed by /ops/performance.
 *
 * Auth: this endpoint is mounted under (dashboard) layout intent but
 * runs as a standalone route — we accept anonymous beacons because
 * `sendBeacon` cannot carry auth headers reliably during page unload.
 * Rate-limit by route name length + payload size cap to mitigate spam.
 */
import { NextResponse } from 'next/server'
import { recordVital, type VitalName } from '@/lib/perf/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED: ReadonlySet<VitalName> = new Set<VitalName>(['LCP', 'INP', 'CLS', 'TTFB', 'FCP'])
const MAX_BODY = 4 * 1024 // 4 KB cap

interface Incoming {
  name?: string
  value?: number
  route?: string
}

export async function POST(req: Request): Promise<Response> {
  const len = Number(req.headers.get('content-length') ?? 0)
  if (len > MAX_BODY) {
    return NextResponse.json({ ok: false, error: 'payload too large' }, { status: 413 })
  }
  let body: Incoming | Incoming[]
  try {
    body = (await req.json()) as Incoming | Incoming[]
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }
  const arr = Array.isArray(body) ? body : [body]
  if (arr.length > 16) {
    return NextResponse.json({ ok: false, error: 'too many samples' }, { status: 400 })
  }
  let accepted = 0
  for (const raw of arr) {
    const name = String(raw.name ?? '').toUpperCase()
    if (!ALLOWED.has(name as VitalName)) continue
    const value = Number(raw.value)
    if (!Number.isFinite(value) || value < 0 || value > 60_000) continue
    let route = String(raw.route ?? '/').slice(0, 120)
    if (!route.startsWith('/')) route = '/'
    recordVital({ name: name as VitalName, value, route, ts: Date.now() })
    accepted += 1
  }
  return NextResponse.json({ ok: true, accepted })
}
