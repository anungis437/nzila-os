/**
 * What a server action may tell its caller about a failure.
 *
 * Actions used to return `error.message`. For a database failure that is the SQL statement and its parameters (Drizzle writes both into the
 * message), for a bug it is whatever the code said; none of it is for the caller. This is the one place that decides:
 *
 *   - a UserFacingError, an operational ApiError (not a server-class one), a validation failure (ZodError), or an error the action names safe
 *     (`isSafe`, for a domain error class of its own): its message is returned, a validation failure as "field: reason";
 *   - the fail-closed identity errors (no organization, no session, no role): a plain sentence the caller can act on;
 *   - anything else: a generic message that carries a short reference, and the full error is logged under that reference, so support can find
 *     what the caller cannot see.
 *
 * `redactLog` keeps even the log free of the error text (an action over personal records, where a driver message can carry the values).
 */
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { ApiError, ErrorCode } from '@/lib/api/errors';
import { isUserFacingError } from '@/lib/errors/user-facing-error';
import { logger } from '@/lib/logger';

export const GENERIC_ACTION_ERROR = 'Something went wrong. Please try again.';

export interface SafeActionErrorOptions {
  /** The operation, for the log: "createRecognitionProgram". */
  action: string;
  /** Fields for the log, never returned. */
  context?: Record<string, unknown>;
  /** The message of an error that may not be shown; the reference is appended. */
  fallback?: string;
  /** Names an error class of the action's own whose message is for the caller. */
  isSafe?: (error: unknown) => boolean;
  /** Log the error's name and code only, not its message. */
  redactLog?: boolean;
  /** false: the caller has already logged the failure, so nothing is logged and the message carries no reference. */
  log?: boolean;
}

export interface SafeActionError {
  message: string;
  /** The reference in the generic message and the log; null when the message is the error's own. */
  reference: string | null;
}

const SERVER_CLASS_CODES = new Set<string>([
  ErrorCode.INTERNAL_ERROR,
  ErrorCode.DATABASE_ERROR,
  ErrorCode.EXTERNAL_SERVICE_ERROR,
  ErrorCode.TIMEOUT,
  ErrorCode.SERVICE_UNAVAILABLE,
  ErrorCode.CIRCUIT_BREAKER_OPEN,
]);

/**
 * The identity and organization resolvers fail closed with errors whose messages are for the log (a user id, an environment variable to set,
 * a bare code). The caller is told what it can act on. Recognised by shape so the action need not import (and tests need not mock) either class.
 */
function identityFailureMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const code = (error as { code?: unknown }).code;
  if (code === 'ORG_CONTEXT_REQUIRED') return 'You do not belong to an organization';
  if (error.name !== 'AuthOrgBindingError') return null;
  switch (code) {
    case 'UNAUTHENTICATED':
    case 'SESSION_AUTHORITY_REQUIRED':
    case 'ACTOR_MISMATCH':
      return 'Unauthorized';
    case 'INVALID_ORGANIZATION':
    case 'MEMBERSHIP_REQUIRED':
      return 'You do not belong to an organization';
    case 'ROLE_REQUIRED':
      return 'Insufficient permissions';
    default:
      return null;
  }
}

/** "field: reason; other: reason" for the first issues of a validation failure. */
export function describeValidationError(error: ZodError): string {
  const issues = error.issues.slice(0, 3).map((issue) => {
    const field = issue.path.map(String).join('.');
    return field ? `${field}: ${issue.message}` : issue.message;
  });
  return issues.length ? `Invalid input. ${issues.join('; ')}` : 'Invalid input.';
}

function shownAsIs(error: unknown, isSafe?: (error: unknown) => boolean): string | null {
  if (error instanceof ZodError) return describeValidationError(error);
  if (error instanceof ApiError) return error.isOperational && !SERVER_CLASS_CODES.has(error.code) ? error.message : null;
  if (isUserFacingError(error)) return error.message;
  const identity = identityFailureMessage(error);
  if (identity !== null) return identity;
  if (isSafe?.(error) && error instanceof Error) return error.message;
  return null;
}

export function safeActionError(error: unknown, options: SafeActionErrorOptions): SafeActionError {
  const own = shownAsIs(error, options.isSafe);
  if (own !== null) return { message: own, reference: null };
  if (options.log === false) return { message: options.fallback ?? GENERIC_ACTION_ERROR, reference: null };

  const reference = randomUUID().slice(0, 8);
  const logged = options.redactLog
    ? new Error(`${options.action} failed`)
    : error instanceof Error
      ? error
      : new Error(String(error));
  logger.error(`Server action failed: ${options.action}`, logged, {
    ...options.context,
    reference,
    errorName: error instanceof Error ? error.name : typeof error,
    errorCode: (error as { code?: unknown } | null)?.code,
  });
  return { message: `${options.fallback ?? GENERIC_ACTION_ERROR} (reference ${reference})`, reference };
}

export function safeActionMessage(error: unknown, options: SafeActionErrorOptions): string {
  return safeActionError(error, options).message;
}
