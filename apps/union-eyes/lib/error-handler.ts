/**
 * Improved Error Handling Utilities
 * 
 * Provides consistent error handling patterns with proper logging
 * and type-safe error wrapping.
 */

import { logger } from '@/lib/logger';

/**
 * Application Error Types
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  DATABASE = 'DATABASE_ERROR',
  EXTERNAL_API = 'EXTERNAL_API_ERROR',
  INTERNAL = 'INTERNAL_ERROR',
}

/**
 * Custom Application Error with additional context
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    type: ErrorType = ErrorType.INTERNAL,
    statusCode = 500,
    isOperational = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ErrorType.VALIDATION, 400, true, context);
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, ErrorType.NOT_FOUND, 404, true);
  }
}

/**
 * Unauthorized Error
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, ErrorType.UNAUTHORIZED, 401, true);
  }
}

/**
 * Forbidden Error
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, ErrorType.FORBIDDEN, 403, true);
  }
}

/**
 * Database Error
 */
export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ErrorType.DATABASE, 500, true, context);
  }
}

/**
 * External API Error
 */
export class ExternalAPIError extends AppError {
  constructor(service: string, message: string, context?: Record<string, unknown>) {
    super(`${service}: ${message}`, ErrorType.EXTERNAL_API, 502, true, context);
  }
}

/**
 * Safe async handler wrapper
 * Catches errors and logs them properly
 * 
 * @example
 * const user = await safeAsync(
 *   () => getUserById(userId),
 *   'Failed to fetch user',
 *   { userId }
 * );
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorMessage: string,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error(errorMessage, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    });
    throw error;
  }
}

/**
 * Safe async handler with default value
 * Returns defaultValue instead of throwing on error
 */
export async function safeAsyncWithDefault<T>(
  fn: () => Promise<T>,
  defaultValue: T,
  errorMessage?: string,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (errorMessage) {
      logger.warn(errorMessage, {
        error: error instanceof Error ? error.message : String(error),
        returnedDefault: true,
        ...context,
      });
    }
    return defaultValue;
  }
}

/**
 * Retry logic with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));

      // Increase delay for next attempt (exponential backoff)
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Wrap database operations with proper error handling
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error(`Database operation failed: ${operationName}`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    });

    throw new DatabaseError(`${operationName} failed`, {
      originalError: errorMessage,
      ...context,
    });
  }
}

/**
 * Handle API route errors consistently
 * Returns a properly formatted error response
 */
export function handleAPIError(error: any): {
  error: string;
  type: ErrorType;
  statusCode: number;
  details?: Record<string, unknown>;
} {
  if (error instanceof AppError) {
    return {
      error: error.message,
      type: error.type,
      statusCode: error.statusCode,
      details: error.context,
    };
  }

  if (error instanceof Error) {
    logger.error('Unhandled error in API route', {
      error: error.message,
      stack: error.stack,
    });

    return {
      error: 'Internal server error',
      type: ErrorType.INTERNAL,
      statusCode: 500,
    };
  }

  return {
    error: 'An unknown error occurred',
    type: ErrorType.INTERNAL,
    statusCode: 500,
  };
}

/**
 * Error boundary for async functions
 * Logs error and returns null instead of throwing
 */
export async function errorBoundary<T>(
  fn: () => Promise<T>,
  fallbackValue: T | null = null,
  logMessage?: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (logMessage) {
      logger.error(logMessage, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    return fallbackValue;
  }
}

/**
 * Type guard to check if error is operational
 */
export function isOperationalError(error: any): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

