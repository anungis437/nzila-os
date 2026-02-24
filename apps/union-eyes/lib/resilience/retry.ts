/**
 * Retry Pattern with Exponential Backoff
 * 
 * Automatically retries failed operations with configurable backoff strategies.
 * Often used in combination with Circuit Breakers.
 * 
 * Usage:
 * ```typescript
 * const retryPolicy = new RetryPolicy({
 *   maxAttempts: 3,
 *   backoff: 'exponential',
 * });
 * 
 * const result = await retryPolicy.execute(async () => {
 *   return await fetchData();
 * });
 * ```
 */

import { logger } from '@/lib/logger';

export type BackoffStrategy = 'fixed' | 'exponential' | 'linear';

export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Initial delay in ms before first retry
   * @default 1000
   */
  initialDelay?: number;

  /**
   * Maximum delay in ms between retries
   * @default 30000
   */
  maxDelay?: number;

  /**
   * Backoff strategy
   * @default 'exponential'
   */
  backoff?: BackoffStrategy;

  /**
   * Multiplier for exponential backoff
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Add random jitter to prevent thundering herd
   * @default true
   */
  jitter?: boolean;

  /**
   * Name for logging
   * @default 'unnamed'
   */
  name?: string;

  /**
   * Determine if error is retryable
   * @default all errors are retryable
   */
  retryableError?: (error: Error) => boolean;

  /**
   * Callback on each retry
   */
  onRetry?: (error: Error, attempt: number) => void;
}

export class RetryPolicy {
  private readonly maxAttempts: number;
  private readonly initialDelay: number;
  private readonly maxDelay: number;
  private readonly backoff: BackoffStrategy;
  private readonly backoffMultiplier: number;
  private readonly jitter: boolean;
  private readonly name: string;
  private readonly retryableError?: (error: Error) => boolean;
  private readonly onRetry?: (error: Error, attempt: number) => void;

  constructor(options: RetryOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.initialDelay = options.initialDelay ?? 1000;
    this.maxDelay = options.maxDelay ?? 30000;
    this.backoff = options.backoff ?? 'exponential';
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
    this.jitter = options.jitter ?? true;
    this.name = options.name ?? 'unnamed';
    this.retryableError = options.retryableError;
    this.onRetry = options.onRetry;
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < this.maxAttempts) {
      try {
        const result = await fn();
        
        if (attempt > 0) {
          logger.info('Retry succeeded', {
            policy: this.name,
            attempt,
          });
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Check if error is retryable
        if (this.retryableError && !this.retryableError(lastError)) {
          logger.debug('Error not retryable', {
            policy: this.name,
            error: lastError.message,
          });
          throw lastError;
        }

        // Don&apos;t wait after last attempt
        if (attempt >= this.maxAttempts) {
          break;
        }

        const delay = this.calculateDelay(attempt);
        
        logger.warn('Retry attempt', {
          policy: this.name,
          attempt,
          maxAttempts: this.maxAttempts,
          delayMs: delay,
          error: lastError.message,
        });

        if (this.onRetry) {
          this.onRetry(lastError, attempt);
        }

        await this.sleep(delay);
      }
    }

    logger.error('Retry exhausted', {
      policy: this.name,
      attempts: this.maxAttempts,
      lastError: lastError?.message,
    });

    throw lastError;
  }

  /**
   * Calculate delay for next retry
   */
  private calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.backoff) {
      case 'fixed':
        delay = this.initialDelay;
        break;
      
      case 'linear':
        delay = this.initialDelay * attempt;
        break;
      
      case 'exponential':
        delay = this.initialDelay * Math.pow(this.backoffMultiplier, attempt - 1);
        break;
      
      default:
        delay = this.initialDelay;
    }

    // Apply max delay cap
    delay = Math.min(delay, this.maxDelay);

    // Apply jitter
    if (this.jitter) {
      const jitterAmount = delay * 0.2; // 20% jitter
      delay = delay - jitterAmount + Math.random() * jitterAmount * 2;
    }

    return Math.round(delay);
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Helper function for common retry scenarios
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const policy = new RetryPolicy(options);
  return policy.execute(fn);
}

/**
 * Decorator for automatic retry
 */
export function retry(options?: RetryOptions) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const policy = new RetryPolicy({
      ...options,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: options?.name || `${(target as any).constructor.name}.${propertyKey}`,
    });

    descriptor.value = async function (...args: unknown[]) {
      return policy.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Common retry policies
 */
export const retryPolicies = {
  /**
   * Quick retry for fast operations (3 attempts, 1-4s)
   */
  quick: new RetryPolicy({
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 4000,
    backoff: 'exponential',
  }),

  /**
   * Standard retry for API calls (5 attempts, 1-30s)
   */
  standard: new RetryPolicy({
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoff: 'exponential',
  }),

  /**
   * Aggressive retry for critical operations (10 attempts, 1-60s)
   */
  aggressive: new RetryPolicy({
    maxAttempts: 10,
    initialDelay: 1000,
    maxDelay: 60000,
    backoff: 'exponential',
  }),

  /**
   * Database retry with linear backoff
   */
  database: new RetryPolicy({
    maxAttempts: 3,
    initialDelay: 500,
    maxDelay: 5000,
    backoff: 'linear',
    retryableError: (error) => {
      // Retry on connection errors, not on constraint violations
      return error.message.includes('connection') || 
             error.message.includes('timeout');
    },
  }),
};

