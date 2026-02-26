/**
 * Standardized API Response Utilities
 * 
 * Provides consistent response formats across all API routes
 * Part of Code Quality improvements for A+ roadmap
 * 
 * Usage:
 *   import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
 * 
 *   // In an API route:
 *   return standardErrorResponse('VALIDATION_ERROR', 'Invalid input', { field: 'email' });
 *   return standardSuccessResponse({ user: userData });
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

/**
 * Standard error codes for consistent error classification
 */
export enum ErrorCode {
  // Authentication & Authorization (401, 403)
  AUTH_ERROR = 'AUTH_ERROR',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Validation Errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Resource Errors (404, 409)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server Errors (500+)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT = 'TIMEOUT',
  
  // Service Unavailability (503)
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',

  // Not Implemented (501)
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
}

/**
 * HTTP status codes mapped to error codes
 */
const ERROR_CODE_TO_STATUS: Record<ErrorCode, number> = {
  // Auth errors
  [ErrorCode.AUTH_ERROR]: 401,
  [ErrorCode.AUTH_REQUIRED]: 401,
  [ErrorCode.AUTH_INVALID]: 401,
  [ErrorCode.AUTH_EXPIRED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  
  // Validation errors
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  
  // Resource errors
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.CONFLICT]: 409,
  
  // Rate limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  
  // Server errors
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.TIMEOUT]: 504,
  
  // Service unavailability
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.CIRCUIT_BREAKER_OPEN]: 503,

  // Not implemented
  [ErrorCode.NOT_IMPLEMENTED]: 501,
};

/**
 * Standard error response format
 */
export interface StandardizedError {
  /** Machine-readable error code */
  code: ErrorCode;
  
  /** User-friendly error message (safe to display) */
  message: string;
  
  /** Additional context (only in development/debug mode) */
  details?: Record<string, unknown>;
  
  /** Unique trace ID for correlation with logs */
  traceId?: string;
  
  /** Timestamp of the error */
  timestamp: string;
}

/**
 * Standard success response format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface StandardizedSuccess<T = any> {
  /** Indicates successful operation */
  success: true;
  
  /** Response data */
  data: T;
  
  /** Optional metadata */
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    hasMore?: boolean;
    [key: string]: unknown;
  };
  
  /** Timestamp of the response */
  timestamp: string;
}

/**
 * Convert unknown error to a safe Record<string, unknown> format
 * Handles Error objects, plain objects, and primitives
 */
function normalizeErrorDetails(details: unknown): Record<string, unknown> | undefined {
  if (details === null || details === undefined) {
    return undefined;
  }
  
  // If already a plain object, return as-is
  if (typeof details === 'object' && !Array.isArray(details) && !(details instanceof Error)) {
    return details as Record<string, unknown>;
  }
  
  // Handle Error objects
  if (details instanceof Error) {
    return {
      message: details.message,
      name: details.name,
      ...(details.stack && { stack: details.stack }),
    };
  }
  
  // Handle primitives and arrays
  return { value: String(details) };
}

/**
 * Generate standardized error response
 * 
 * @param code - Error code from ErrorCode enum
 * @param message - User-friendly error message
 * @param details - Additional context (accepts unknown for catch blocks)
 * @param traceId - Optional trace ID for correlation
 * @returns NextResponse with standardized error format
 * 
 * @example
 * return standardErrorResponse(
 *   ErrorCode.VALIDATION_ERROR,
 *   'Email address is invalid',
 *   { field: 'email', provided: req.body.email }
 * );
 */
export function standardErrorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown,
  traceId?: string
): NextResponse<StandardizedError> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const statusCode = ERROR_CODE_TO_STATUS[code] || 500;
  
  // Generate or use existing trace ID
  const finalTraceId = traceId || generateTraceId();
  
  // Normalize and sanitize details to prevent information leakage
  const normalizedDetails = normalizeErrorDetails(details);
  const sanitizedDetails = isDevelopment ? normalizedDetails : sanitizeErrorDetails(normalizedDetails);
  
  // Log error with appropriate severity (never log raw Error objects)
  const severity = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  logger[severity]('API Error Response', {
    code,
    message,
    statusCode,
    traceId: finalTraceId,
    details: sanitizedDetails,
  });
  
  // Report 5xx errors to Sentry
  if (statusCode >= 500) {
    Sentry.captureException(new Error(`${code}: ${message}`), {
      level: 'error',
      tags: { errorCode: code },
      extra: { details, traceId: finalTraceId },
    });
  }
  
  const errorResponse: StandardizedError = {
    code,
    message,
    timestamp: new Date().toISOString(),
    traceId: finalTraceId,
  };
  
  // Only include details in development or for specific error types
  if (isDevelopment || code === ErrorCode.VALIDATION_ERROR) {
    errorResponse.details = details as Record<string, unknown> | undefined;
  }
  
  return NextResponse.json(errorResponse, { 
    status: statusCode,
    headers: {
      'X-Trace-ID': finalTraceId,
      'X-Error-Code': code,
    },
  });
}

/**
 * Generate standardized success response
 * 
 * @param data - Response data
 * @param meta - Optional metadata (pagination, etc.)
 * @returns NextResponse with standardized success format
 * 
 * @example
 * return standardSuccessResponse(
 *   { users: userList },
 *   { page: 1, pageSize: 20, total: 150, hasMore: true }
 * );
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function standardSuccessResponse<T = any>(
  data: T,
  meta?: StandardizedSuccess<T>['meta']
): NextResponse<StandardizedSuccess<T>> {
  const response: StandardizedSuccess<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  
  if (meta) {
    response.meta = meta;
  }
  
  return NextResponse.json(response);
}

/**
 * Generate a unique trace ID for error correlation
 */
function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomUUID().substring(0, 8);
  return `${timestamp}-${randomPart}`;
}

/**
 * Sanitize error details to prevent leaking sensitive information
 * Removes stack traces, removes sensitive keys, truncates long strings
 */
function sanitizeErrorDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;
  
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie', 'session'];
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(details)) {
    // Skip sensitive keys
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      continue;
    }
    
    // Remove stack traces
    if (key === 'stack' || key === 'stackTrace') {
      continue;
    }
    
    // Truncate long strings
    if (typeof value === 'string' && value.length > 200) {
      sanitized[key] = value.substring(0, 200) + '...';
    } else if (typeof value === 'object' && value !== null) {
      // Don&apos;t include nested objects in production
      sanitized[key] = '[Object]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Convert common error types to standardized responses
 * 
 * @example
 * try {
 *   // ... operation
 * } catch (error) {
 *   return fromError(error);
 * }
 */
export function fromError(error: unknown): NextResponse<StandardizedError> {
  // Handle known error types
  if (error instanceof Error) {
    // Drizzle/Database errors
    if (error.name === 'PostgresError' || error.message.includes('database')) {
      return standardErrorResponse(
        ErrorCode.DATABASE_ERROR,
        'Database operation failed',
        { originalError: error.message }
      );
    }
    
    // Auth errors (from Clerk or our auth system)
    if (error.message.toLowerCase().includes('unauthorized') || 
        error.message.toLowerCase().includes('authentication')) {
      return standardErrorResponse(
        ErrorCode.AUTH_ERROR,
        'Authentication failed',
        { originalError: error.message }
      );
    }
    
    // Forbidden/permission errors
    if (error.message.toLowerCase().includes('forbidden') || 
        error.message.toLowerCase().includes('permission')) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        'Insufficient permissions',
        { originalError: error.message }
      );
    }
    
    // Not found errors
    if (error.message.toLowerCase().includes('not found')) {
      return standardErrorResponse(
        ErrorCode.NOT_FOUND,
        'Resource not found',
        { originalError: error.message }
      );
    }
    
    // Generic error
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'An internal error occurred',
      { originalError: error.message, stack: error.stack }
    );
  }
  
  // Unknown error type
  return standardErrorResponse(
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred'
  );
}

/**
 * Higher-order function to wrap API route handlers with standardized error handling
 * 
 * @example
 * export const GET = withStandardizedErrors(async (request) => {
 *   const data = await fetchData();
 *   return standardSuccessResponse(data);
 * });
 */
export function withStandardizedErrors<T extends (...args: unknown[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: unknown[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      return fromError(error);
    }
  }) as T;
}

/**
 * Validation helper that throws standardized error
 */
export function validateRequired(
  value: unknown,
  fieldName: string
): void {
  if (value === undefined || value === null || value === '') {
    throw new ValidationResponseError(
      `Missing required field: ${fieldName}`,
      { field: fieldName }
    );
  }
}

/**
 * Custom error class for throwing validation errors that will be caught
 * by withStandardizedErrors
 */
export class ValidationResponseError extends Error {
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationResponseError';
  }
}

/**
 * Convert to standardized error (handles ValidationResponseError)
 */
export function toStandardizedError(error: unknown): NextResponse<StandardizedError> {
  if (error instanceof ValidationResponseError) {
    return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      error.message,
      error.details
    );
  }
  
  return fromError(error);
}
