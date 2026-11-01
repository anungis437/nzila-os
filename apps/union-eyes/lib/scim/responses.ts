/**
 * The SCIM 2.0 wire format (RFC 7644).
 *
 * withApi wraps what a handler returns in its own envelope ({ success, data, timestamp }) and formats a thrown error as its own JSON error. An
 * identity provider reads neither: it expects the resource, or the list response, as the body and a SCIM error ({ schemas, status, scimType, detail })
 * for a refusal, as application/scim+json. A handler that returns a NextResponse is passed through unwrapped, so the SCIM routes answer with the
 * helpers here and run their work through `handleScim()`, which turns the errors a SCIM request can raise into SCIM errors. An error it does not know is
 * rethrown, so a fault is still reported as one and is not dressed up as a client error.
 */
import { NextResponse } from 'next/server';
import { ErrorCode } from '@/lib/api/errors';
import { ScimConfigurationNotLiveError } from '@/lib/scim/provisioned-members';

export const SCIM_CONTENT_TYPE = 'application/scim+json; charset=utf-8';
export const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';

export type ScimErrorType = 'invalidFilter' | 'uniqueness' | 'mutability' | 'invalidSyntax' | 'invalidPath' | 'noTarget' | 'invalidValue';

/** A refusal with the HTTP status and SCIM error type it is to be reported under. */
export class ScimHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly scimType?: ScimErrorType,
  ) {
    super(message);
    this.name = 'ScimHttpError';
  }
}

export function scimJson(body: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Content-Type': SCIM_CONTENT_TYPE, 'Cache-Control': 'no-store', ...headers } });
}

export function scimError(status: number, detail: string, scimType?: ScimErrorType): NextResponse {
  return scimJson({ schemas: [SCIM_ERROR_SCHEMA], status: String(status), ...(scimType ? { scimType } : {}), detail }, status);
}

export function scimNoContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

const STATUS_OF_CODE: Partial<Record<string, number>> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.AUTH_REQUIRED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
};

// A thrown ApiError carries a code that maps to a status; a framework test double carries the status itself.
function httpStatusOf(error: unknown): number | null {
  const candidate = error as { status?: unknown; code?: unknown } | null;
  if (typeof candidate?.status === 'number' && candidate.status >= 400 && candidate.status < 500) return candidate.status;
  return typeof candidate?.code === 'string' ? (STATUS_OF_CODE[candidate.code] ?? null) : null;
}

/** The SCIM error for a refusal this layer knows, or null for anything else. */
export function scimErrorFrom(error: unknown): NextResponse | null {
  if (error instanceof ScimHttpError) return scimError(error.status, error.message, error.scimType);
  if (error instanceof ScimConfigurationNotLiveError) return scimError(403, 'SCIM provisioning is not enabled for this organization');
  const status = httpStatusOf(error);
  if (status === null) return null;
  const message = error instanceof Error ? error.message : 'The request was refused';
  return scimError(status, message, status === 409 ? 'uniqueness' : undefined);
}

/** Runs a SCIM request, answering a refusal as a SCIM error and rethrowing anything else. */
export async function handleScim(work: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await work();
  } catch (error) {
    const response = scimErrorFrom(error);
    if (response) return response;
    throw error;
  }
}
