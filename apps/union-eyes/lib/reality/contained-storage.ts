import { ApiError, ErrorCode } from '@/lib/api/errors'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'

/**
 * Relations the current canonical source contains: no runtime grant, no system grant (CONTAINED_NO_AUTHORITY in
 * lib/operations/catalog-v2-decisions.json, compiled by tooling/scripts/write-union-eyes-current-catalog.ts from the V2 source plan).
 * Their historical rows are preserved and no application role may read or write them, so a capability that needs one has no authority
 * to run: it answers 501 NOT_IMPLEMENTED with the reason, before any statement reaches the database, as the dues and rewards boundaries do
 * (lib/dues/member-dues-flag.ts, lib/rewards/credit-authority.ts). No role or caller flag grants it.
 *
 * The containment is a decision of the canonical source, so it binds a canonical deployment (UE_CANONICAL_BOOTSTRAP_V2=1, the mode every
 * current deployment and the native acceptance run in). The legacy lineage, whose historical catalog still grants these relations, keeps
 * its behaviour; nothing here widens what either catalog grants.
 */
export const CONTAINED_STORAGE_REASONS = {
  per_capita_remittances:
    'Per-capita remittance records are not available: affiliate remittances are handled in an external system, and the current source grants no application role authority over them',
  employer_remittances:
    'Employer remittance records are not available: the current source grants no application role authority over them, and dues remittances are handled in an external system',
  payments:
    'Payment records are not available: payments are outside this release, and the current source grants no application role authority over them',
  signature_audit_trail:
    'The e-signature audit trail is not available: the current source grants no application role authority over it, so no signature event can be recorded or read with its required trail',
  arbitration_decisions:
    'The arbitration precedent library is not available: the current source has no qualified ownership for arbitration decisions and grants no application role authority over them',
} as const

export type ContainedStorage = keyof typeof CONTAINED_STORAGE_REASONS

export class ContainedStorageUnavailable extends ApiError {
  readonly status = 501
  constructor(readonly storage: ContainedStorage) {
    super(ErrorCode.NOT_IMPLEMENTED, CONTAINED_STORAGE_REASONS[storage])
    this.name = 'ContainedStorageUnavailable'
  }
}

/** The same refusal as a response, for a handler produced outside withApi (lib/api/crud-factory routes). */
export function containedStorageResponse(storage: ContainedStorage): Response {
  const error = new ContainedStorageUnavailable(storage)
  return Response.json({ code: 'NOT_IMPLEMENTED', message: error.message, capabilityState: 'NOT_IMPLEMENTED', timestamp: new Date().toISOString() },
    { status: 501, headers: { 'X-Error-Code': 'NOT_IMPLEMENTED' } })
}

/** Wraps route handlers so a canonical deployment answers 501 before the handler (or any statement) runs. */
export function containedStorageHandlers<H extends Record<string, (...args: never[]) => Promise<Response>>>(storage: ContainedStorage, handlers: H): H {
  const wrapped: Record<string, unknown> = {}
  for (const [method, handler] of Object.entries(handlers))
    wrapped[method] = (...args: never[]) => (currentStateContextEnabled() ? Promise.resolve(containedStorageResponse(storage)) : handler(...args))
  return wrapped as H
}

/** Source boundary: call it first, before any database, provider or audit side effect. */
export function requireContainedStorageAuthority(storage: ContainedStorage): void {
  if (currentStateContextEnabled()) throw new ContainedStorageUnavailable(storage)
}
