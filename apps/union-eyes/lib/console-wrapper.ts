/**
 * Production Console Wrapper
 * 
 * Filters and routes console output in production to prevent sensitive data leaks.
 * 
 * Features:
 * - Disables console.log in production (info-level logs should use logger.info)
 * - Routes console.error to structured logger with Sentry integration
 * - Preserves full console behavior in development
 * - Prevents accidental sensitive data exposure in production logs
 * 
 * @module lib/console-wrapper
 */

import { logger } from './logger';

// Store original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

/**
 * Initialize console wrapper for production
 * 
 * Call this once during application initialization:
 * - In instrumentation.ts for server-side
 * - In instrumentation-client.ts for client-side
 */
export function initializeConsoleWrapper(): void {
  // Only apply filtering in production
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  // Disable console.log in production (use logger.info instead)
  console.log = (..._args: unknown[]) => {
    // Silent in production - developers should use logger.info()
    // This prevents accidental sensitive data leaks
  };

  // Disable console.info in production (use logger.info instead)
  console.info = (..._args: unknown[]) => {
    // Silent in production - use structured logger
  };

  // Route console.warn to structured logger
  console.warn = (...args: unknown[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    logger.warn(message);
  };

  // Route console.error to structured logger with Sentry
  console.error = (...args: unknown[]) => {
    // Extract error object if present
    const errorArg = args.find(arg => arg instanceof Error);
    const otherArgs = args.filter(arg => arg !== errorArg);
    
    const message = otherArgs.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    // Use structured logger with error tracking
    if (errorArg instanceof Error) {
      logger.error(message || errorArg.message, errorArg);
    } else {
      logger.error(message);
    }
  };

  // Disable console.debug in production
  console.debug = (..._args: unknown[]) => {
    // Silent in production - debug logs are dev-only
  };
}

/**
 * Restore original console methods (for testing purposes)
 */
export function restoreConsole(): void {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
}

/**
 * Get access to original console (for internal tooling use only)
 */
export function getOriginalConsole() {
  return originalConsole;
}

