/**
 * Unified API Error System
 *
 * Bridges the existing AppError class hierarchy (lib/error-handler.ts) with
 * the standardized response helpers (lib/api/standardized-responses.ts) into
 * a single throwable error that `withApi()` automatically serialises.
 *
 * Usage inside any route handler:
 *
 *   throw new ApiError('NOT_FOUND', 'Member not found', { memberId });
 *
 * The `withApi()` wrapper will catch it and call `standardErrorResponse()`
 * with the correct status code, trace-id, and Sentry reporting.
 *
 * @module lib/api/errors
 */

import { ErrorCode } from './standardized-responses';

// Re-export ErrorCode so route files only need one import
export { ErrorCode };

/**
 * Throwable API error — the single error class for all route handlers.
 *
 * Designed to be caught by `withApi()` and converted into the standard
 * JSON envelope via `standardErrorResponse()`.
 */
export class ApiError extends Error {
  /** Machine-readable error code (maps to HTTP status automatically) */
  public readonly code: ErrorCode;

  /** Optional structured details (only surfaced in development) */
  public readonly details?: Record<string, unknown>;

  /** Whether this is an expected operational error (vs. programming bug) */
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    isOperational = true,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, ApiError);
  }

  // ── Convenience factories ────────────────────────────────────────────────

  static badRequest(message: string, details?: Record<string, unknown>) {
    return new ApiError(ErrorCode.VALIDATION_ERROR, message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(ErrorCode.AUTH_REQUIRED, message);
  }

  static forbidden(message = 'Insufficient permissions') {
    return new ApiError(ErrorCode.FORBIDDEN, message);
  }

  static notFound(resource: string, id?: string) {
    const msg = id ? `${resource} '${id}' not found` : `${resource} not found`;
    return new ApiError(ErrorCode.NOT_FOUND, msg, id ? { resource, id } : { resource });
  }

  static conflict(message: string, details?: Record<string, unknown>) {
    return new ApiError(ErrorCode.CONFLICT, message, details);
  }

  static rateLimited(resetIn: number) {
    return new ApiError(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', { resetIn });
  }

  static internal(message = 'An internal error occurred', details?: Record<string, unknown>) {
    return new ApiError(ErrorCode.INTERNAL_ERROR, message, details, false);
  }

  static database(message: string, details?: Record<string, unknown>) {
    return new ApiError(ErrorCode.DATABASE_ERROR, message, details, false);
  }

  static externalService(service: string, message: string) {
    return new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, `${service}: ${message}`, { service });
  }

  static notImplemented(message = 'This endpoint is not yet implemented') {
    return new ApiError(ErrorCode.NOT_IMPLEMENTED, message);
  }

  /**
   * Convert a Zod error into a validation ApiError with field-level details.
   */
  static fromZod(zodError: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
    const fields = zodError.issues.map((e) => ({
      path: e.path.map(String).join('.'),
      message: e.message,
    }));
    return new ApiError(ErrorCode.VALIDATION_ERROR, fields[0]?.message ?? 'Validation failed', {
      fields,
    });
  }
}
