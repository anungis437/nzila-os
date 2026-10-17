import { NextResponse } from 'next/server'
import { ApiError } from '@/lib/api/errors'

/**
 * Entitlement and role denials thrown by shared guards are authorization outcomes, not server
 * faults. Route-level catch blocks call this first so they answer 403 instead of 500.
 */
export function authorizationDenialResponse(error: unknown): NextResponse | null {
  const denial = error as { code?: unknown; message?: unknown } | null
  if (denial?.code === 'ENTITLEMENT_REQUIRED')
    return NextResponse.json(
      { error: 'Module access denied', code: 'ENTITLEMENT_REQUIRED' },
      { status: 403 },
    )
  if (typeof denial?.message === 'string' && /^(Error: )?Forbidden: Requires /.test(denial.message))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

/**
 * Malformed synthetic or client requests (wrong content type, unparsable JSON, a body that was
 * already consumed) are client errors. Combined with authorization denials for route catch blocks.
 */
export function clientErrorResponse(error: unknown): NextResponse | null {
  const denied = authorizationDenialResponse(error)
  if (denied) return denied
  const failure = error as { name?: unknown; message?: unknown } | null
  const message = typeof failure?.message === 'string' ? failure.message : ''
  if (failure?.name === 'TypeError' && /Content-Type was not one of/.test(message))
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
  if (failure?.name === 'SyntaxError' && /JSON/.test(message))
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  return null
}
/**
 * The PKI capability reads relations (digital_signatures, signature workflow columns) that are not
 * part of the canonical bootstrap contract: digital_signatures is declared only in the separate
 * financial-service database. An undefined-relation or undefined-column failure is therefore an
 * unprovisioned capability (501), never a generic server fault, and no historical object is invented.
 *
 * The failed statement has already aborted the surrounding tenant transaction, so a route must not
 * answer from its own catch block; it rethrows an ApiError so the shared wrapper rolls back and responds.
 */
export function throwIfUnprovisionedRelation(error: unknown): void {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const code = (current as { code?: unknown }).code
    if (code === '42P01' || code === '42703')
      throw ApiError.notImplemented(
        'Capability relation is not provisioned in the canonical bootstrap contract',
      )
    current = (current as { cause?: unknown }).cause
  }
}
