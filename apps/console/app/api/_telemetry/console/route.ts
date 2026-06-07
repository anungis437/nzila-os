/**
 * Console workspace telemetry beacon endpoint.
 *
 * Accepts small JSON payloads from the in-page workspace telemetry emitter
 * (sendBeacon). Validates against the allow-list in
 * docs/doctrine/NZILA_CONSOLE_TELEMETRY_SCHEMA.md, assigns the timestamp
 * server-side, and writes to the in-process ring buffer.
 *
 * Anonymous beacons are accepted (sendBeacon cannot carry auth on unload);
 * size and batch caps are the only rate limit. No PII is recorded.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRequestContext, requireOrgAccess } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import {
  recordConsoleEvent,
  CONSOLE_EVENT_TYPES,
  CONSOLE_WORKSPACES,
  type ConsoleEventType,
  type ConsoleWorkspace,
} from '@/lib/console-telemetry/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 4 * 1024 // 4 KB cap
const MAX_BATCH = 16
const ALLOWED_TYPES = new Set<string>(CONSOLE_EVENT_TYPES)
const ALLOWED_WORKSPACES = new Set<string>(CONSOLE_WORKSPACES)

interface Incoming {
  type?: string
  workspace?: string
  tab?: string | null
}

const IncomingSchema = z.object({
  type: z.string().optional(),
  workspace: z.string().optional(),
  tab: z.string().max(64).nullable().optional(),
})

const PayloadSchema = z.union([
  IncomingSchema,
  z.array(IncomingSchema).max(MAX_BATCH),
])

export async function POST(req: Request): Promise<Response> {
  return withRequestContext(req, async () => {
    return withSpan('api.telemetry.console.post', {}, async () => {
      const orgId = new URL(req.url).searchParams.get('orgId')
      if (orgId) {
        const access = await requireOrgAccess(orgId)
        if (!access.ok) return access.response
      }

      const len = Number(req.headers.get('content-length') ?? 0)
      if (len > MAX_BODY) {
        return NextResponse.json({ ok: false, error: 'payload too large' }, { status: 413 })
      }

      const json = await req.json().catch(() => null)
      const parsed = PayloadSchema.safeParse(json)
      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: 'invalid payload' }, { status: 400 })
      }

      const body: Incoming | Incoming[] = parsed.data
      const arr = Array.isArray(body) ? body : [body]
      if (arr.length > MAX_BATCH) {
        return NextResponse.json({ ok: false, error: 'too many events' }, { status: 400 })
      }

      let accepted = 0
      for (const raw of arr) {
        const type = String(raw.type ?? '')
        if (!ALLOWED_TYPES.has(type)) continue
        const workspace = String(raw.workspace ?? '')
        if (!ALLOWED_WORKSPACES.has(workspace)) continue
        const tab = typeof raw.tab === 'string' ? raw.tab.slice(0, 64) : null
        recordConsoleEvent({
          type: type as ConsoleEventType,
          workspace: workspace as ConsoleWorkspace,
          tab,
          ts: Date.now(),
        })
        accepted += 1
      }

      return NextResponse.json({ ok: true, accepted })
    })
  })
}
