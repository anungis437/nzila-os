/**
 * Shared HTTP plumbing for the union-side WorkAid routes (/api/workaid/**).
 *
 * Every route is a thin adapter over lib/authority/store/workaid-disclosure: the authenticated session principal
 * becomes the transaction's actor, the organization comes from the authenticated membership (never the request), and
 * the kernel decides. No route here reaches counsel. Counsel-side activation and key custody (UE-CONV-G-003) are
 * external and absent, so a successful response is ALWAYS a union-side record only, and says so.
 */
import { NextResponse } from 'next/server'
import type { z } from 'zod'
import { AuthorityStoreError } from '@/lib/authority/store/executor'
import { caseAuthorizationResponse } from '@/lib/cases/case-authorization'

/** Merged into every successful mutation response so nothing is mistaken for delivery to, or acceptance by, counsel. */
export const COUNSEL_SIDE_NOTICE = {
  counselSide: 'not_activated',
  delivered: false,
  counselAcknowledged: false,
  note: 'Recorded on the union side only. No counsel-side system is connected: nothing has been transmitted to or accepted by counsel.',
} as const

export async function parseBody<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'INVALID_INPUT', message: 'Request body must be valid JSON.' }, { status: 400 }) }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Invalid request.', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) }, { status: 400 }),
    }
  }
  return { ok: true, data: parsed.data }
}

const CODE = /\b([A-Z][A-Z0-9_]{3,})\b/

/** Maps a store refusal to a status. Anything that is not a deliberate refusal is rethrown (a 500, never a guess). */
export function workAidErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthorityStoreError) {
    const code = CODE.exec(error.message)?.[1] ?? error.code
    const status: Record<AuthorityStoreError['code'], number> = {
      DENIED: 403,
      NOT_FOUND: 404,
      PRECONDITION: 409,
      ALREADY_TERMINAL: 409,
      IDEMPOTENCY_CONFLICT: 409,
      INVALID_CONTEXT: 400,
    }
    return NextResponse.json({ success: false, error: error.code, code }, { status: status[error.code] })
  }
  const denied = caseAuthorizationResponse(error)
  if (denied) return denied
  throw error
}
