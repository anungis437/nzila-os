/**
 * Console workspace telemetry beacon endpoint.
 *
 * NOTE: In Next.js App Router, folders prefixed with `_` are private and not routable.
 * This route uses `%5Ftelemetry` so it serves `/api/_telemetry/console`.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRequestContext, requireOrgAccess } from '@/lib/api-guards'
import { getExecutiveOrgId } from '@/lib/executive-os'
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
      const orgId = await getExecutiveOrgId()
      if (!orgId) {
        return NextResponse.json({ ok: false, error: 'organization context unavailable' }, { status: 503 })
      }

      const access = await requireOrgAccess(orgId)
      if (!access.ok) return access.response

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
