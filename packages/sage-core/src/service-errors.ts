// ─── @nzila/sage-core — typed service errors ─────────────────────────────────

export type SageServiceErrorCode =
  | 'FORBIDDEN'
  | 'PERMISSION_DENIED'
  | 'ORG_BOUNDARY'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'INVARIANT_VIOLATION'
  | 'CONFLICT'
  | 'INTEGRITY_ERROR'
  | 'RATE_LIMITED'

export class SageServiceError extends Error {
  readonly code: SageServiceErrorCode

  constructor(code: SageServiceErrorCode, message: string) {
    super(message)
    this.name = 'SageServiceError'
    this.code = code
  }
}

export function permissionDenied(permission: string): never {
  throw new SageServiceError('PERMISSION_DENIED', `Missing SAGE permission: ${permission}`)
}

export function orgBoundary(message = 'Cross-org access denied'): never {
  throw new SageServiceError('ORG_BOUNDARY', message)
}

export function notFound(what: string): never {
  throw new SageServiceError('NOT_FOUND', `${what} not found`)
}

export function invalidInput(message: string): never {
  throw new SageServiceError('INVALID_INPUT', message)
}

export function forbidden(message: string): never {
  throw new SageServiceError('FORBIDDEN', message)
}

export function conflict(message: string): never {
  throw new SageServiceError('CONFLICT', message)
}

/**
 * A stored artifact failed cryptographic integrity verification (its bytes no
 * longer match the immutable committed hashes). Never returns the artifact.
 */
export function integrityError(message = 'stored package failed integrity verification'): never {
  throw new SageServiceError('INTEGRITY_ERROR', message)
}

/** The caller exceeded a recipient claim/access rate limit. */
export function rateLimited(message = 'too many attempts; retry later'): never {
  throw new SageServiceError('RATE_LIMITED', message)
}
