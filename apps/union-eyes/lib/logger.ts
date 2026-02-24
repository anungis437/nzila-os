/**
 * Production-grade structured logger with Sentry integration
 * 
 * Features:
 * - Structured logging with correlation IDs
 * - Automatic Sentry error tracking
 * - Performance timing
 * - Sensitive data redaction
 * - Environment-aware output
 * 
 * Note: Sentry is imported lazily to prevent bundling during build phase
 */

// Lazy-load Sentry to avoid bundling during Next.js build phase
let Sentry: typeof import('@sentry/nextjs') | null = null;
const getSentry = async () => {
  if (!Sentry && typeof window === 'undefined') {
    try {
      Sentry = await import('@sentry/nextjs');
    } catch (_e) {
      // Silent fail if Sentry not available during build
    }
  }
  return Sentry;
};

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = Record<string, unknown>;

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  correlationId?: string;
  userId?: string;
  organizationId?: string;
}

class Logger {
  private static instance: Logger;
  private correlationId: string;

  private constructor() {
    this.correlationId = crypto.randomUUID();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set correlation ID for request tracing
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Redact sensitive fields from context
   */
  private redactSensitiveData(context: LogContext): LogContext {
    const sensitiveKeys = [
      'password',
      'token',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
      'creditCard',
      'ssn',
      'sin',
      'email', // Partially redact
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'privateKey',
      'private_key',
      'clientSecret',
      'client_secret',
      'sessionToken',
      'session_token',
      'bearerToken',
      'bearer_token',
    ];

    const redacted = { ...context };

    for (const [key, value] of Object.entries(redacted)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        if (key.toLowerCase().includes('email') && typeof value === 'string') {
          // Partial redaction for emails: u***@example.com
          const [local, domain] = value.split('@');
          redacted[key] = `${local[0]}***@${domain}`;
        } else {
          redacted[key] = '[REDACTED]';
        }
      }
    }

    return redacted;
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    if (process.env.NODE_ENV === 'production') {
      // JSON format for production log aggregation
      return JSON.stringify(entry);
    } else {
      // Human-readable format for development
      const { level, message, context, timestamp, correlationId } = entry;
      const emoji = {
        debug: '🐛',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
      }[level];

      let output = `${emoji} [${timestamp}] [${level.toUpperCase()}] [${correlationId}] ${message}`;
      
      if (context && Object.keys(context).length > 0) {
        output += `\n  Context: ${JSON.stringify(context, null, 2)}`;
      }

      return output;
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry: LogEntry = {
      level,
      message,
      context: context ? this.redactSensitiveData(context) : undefined,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
    };

    const formatted = this.formatLogEntry(entry);

    // Console output in development only
    if (process.env.NODE_ENV !== 'production') {
      const consoleFn = {
        debug: console.debug,
        info: console.info,
        warn: console.warn,
        error: console.error,
      }[level];
      consoleFn(formatted);
    }

    // Send to Sentry based on level (async, fire-and-forget)
    if (level === 'error' || level === 'warn') {
      getSentry().then(S => {
        if (!S) return;
        if (level === 'error') {
          S.captureException(new Error(message), {
            level: 'error',
            extra: entry.context,
            tags: {
              correlationId: this.correlationId,
            },
          });
        } else if (level === 'warn') {
          S.captureMessage(message, {
            level: 'warning',
            extra: entry.context,
            tags: {
              correlationId: this.correlationId,
            },
          });
        }
      }).catch(() => {
        // Silent fail if Sentry not available
      });
    }

    // In production, you might also send to a log aggregation service here
    // e.g., Datadog, CloudWatch, Logtail, etc.
  }

  /**
   * Debug level logging (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', message, context);
    }
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        // Only include first 3 lines of stack trace in production (for debugging)
        // Full stack trace leaks file paths and internal structure
        stack: isProduction 
          ? error.stack?.split('\n').slice(0, 3).join('\n')
          : error.stack,
        // Additional error properties (if any)
        ...(error.cause ? { cause: String(error.cause) } : {}),
      } : String(error),
    };

    this.log('error', message, errorContext);

    // Capture full error in Sentry (async, fire-and-forget)
    if (error instanceof Error) {
      getSentry().then(S => {
        if (!S) return;
        S.captureException(error, {
          extra: context,
          tags: {
            correlationId: this.correlationId,
          },
        });
      }).catch(() => {
        // Silent fail if Sentry not available
      });
    }
  }

  /**
   * Performance timing utility
   */
  time(label: string): () => void {
    const start = Date.now();
    
    return () => {
      const duration = Date.now() - start;
      this.info(`Performance: ${label}`, { durationMs: duration });
      
      // Track slow operations
      if (duration > 1000) {
        this.warn(`Slow operation detected: ${label}`, { durationMs: duration });
      }
    };
  }

  /**
   * HTTP request logging helper
   */
  httpRequest(
    method: string,
    path: string,
    status: number,
    durationMs: number,
    context?: LogContext
  ): void {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    
    this.log(level, `HTTP ${method} ${path} ${status}`, {
      method,
      path,
      status,
      durationMs,
      ...context,
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

/**
 * Middleware helper to set correlation ID from request headers
 */
export function setRequestCorrelationId(request: Request): string {
  const correlationId = 
    request.headers.get('x-correlation-id') || 
    request.headers.get('x-request-id') || 
    crypto.randomUUID();
  
  logger.setCorrelationId(correlationId);
  return correlationId;
}

/**
 * API route wrapper with automatic logging
 */
export function withLogging<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
  routeName: string
): T {
  return (async (...args: Parameters<T>): Promise<Response> => {
    const request = args[0] as Request;
    const startTime = Date.now();
    
    // Set correlation ID
    const correlationId = setRequestCorrelationId(request);
    
    try {
      const response = await handler(...args);
      const duration = Date.now() - startTime;
      
      logger.httpRequest(
        request.method,
        routeName,
        response.status,
        duration,
        {
          correlationId,
        }
      );
      
      // Add correlation ID to response headers
      response.headers.set('x-correlation-id', correlationId);
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`Unhandled error in ${routeName}`, error, {
        method: request.method,
        correlationId,
        durationMs: duration,
      });
      
      throw error;
    }
  }) as T;
}

