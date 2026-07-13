/**
 * Platform Admin — SAGE route helpers
 *
 * Maps `SageServiceError` codes from the SAGE service layer onto HTTP responses,
 * using the same `{ ok, error }` envelope as the rest of platform-admin.
 */
import { NextResponse } from 'next/server'
import { SageInvariantError, SageServiceError } from '@nzila/sage-core'

const CODE_TO_STATUS: Record<string, number> = {
  PERMISSION_DENIED: 403,
  FORBIDDEN: 403,
  ORG_BOUNDARY: 403,
  NOT_FOUND: 404,
  INVALID_INPUT: 400,
  INVARIANT_VIOLATION: 422,
  CONFLICT: 409,
  // A stored artifact failed cryptographic integrity verification. Server-side
  // data problem; return 500 without disclosing storage details.
  INTEGRITY_ERROR: 500,
}

export function sageErrorResponse(error: unknown): NextResponse {
  if (error instanceof SageServiceError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: CODE_TO_STATUS[error.code] ?? 500 },
    )
  }
  // A domain invariant violation (e.g. linking evidence before its source is
  // classified) is a 422 — a well-formed request the domain rules reject.
  if (error instanceof SageInvariantError) {
    return NextResponse.json(
      { ok: false, error: { code: 'INVARIANT_VIOLATION', message: error.message } },
      { status: 422 },
    )
  }
  return NextResponse.json(
    { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
    { status: 500 },
  )
}

export function sageNotFoundResponse(): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } },
    { status: 404 },
  )
}
