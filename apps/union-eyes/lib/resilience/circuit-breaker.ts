/**
 * Circuit Breaker Pattern
 * 
 * Prevents cascading failures by detecting failures and temporarily
 * blocking requests to failing services.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests
 * 
 * Usage:
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   resetTimeout: 60000,
 * });
 * 
 * const result = await breaker.execute(async () => {
 *   return await externalApiCall();
 * });
 * ```
 */

import { logger } from '@/lib/logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /**
   * Number of failures before opening circuit
   * @default 5
   */
  failureThreshold?: number;

  /**
   * Number of successes in HALF_OPEN to close circuit
   * @default 2
   */
  successThreshold?: number;

  /**
   * Time in ms before attempting to close circuit
   * @default 60000 (60 seconds)
   */
  resetTimeout?: number;

  /**
   * Timeout in ms for individual requests
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Name for logging and monitoring
   * @default 'unnamed'
   */
  name?: string;

  /**
   * Custom error filter to determine if error should trigger circuit
   * @default all errors trigger
   */
  errorFilter?: (error: Error) => boolean;

  /**
   * Callback when circuit state changes
   */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitState: CircuitState
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = Date.now();
  private lastError?: Error;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly resetTimeout: number;
  private readonly timeout: number;
  private readonly name: string;
  private readonly errorFilter?: (error: Error) => boolean;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.resetTimeout = options.resetTimeout ?? 60000;
    this.timeout = options.timeout ?? 30000;
    this.name = options.name ?? 'unnamed';
    this.errorFilter = options.errorFilter;
    this.onStateChange = options.onStateChange;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        const error = new CircuitBreakerError(
          `Circuit breaker '${this.name}' is OPEN. Last error: ${this.lastError?.message}`,
          CircuitState.OPEN
        );
        logger.warn('Circuit breaker request blocked', {
          breaker: this.name,
          state: this.state,
          nextAttempt: new Date(this.nextAttempt),
        });
        throw error;
      }
      
      // Transition to HALF_OPEN
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Circuit breaker timeout after ${this.timeout}ms`));
        }, this.timeout);
      }),
    ]);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.successCount = 0;
        logger.info('Circuit breaker recovered', { breaker: this.name });
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.lastError = error;

    // Check if error should trigger circuit
    if (this.errorFilter && !this.errorFilter(error)) {
      logger.debug('Circuit breaker error filtered', {
        breaker: this.name,
        error: error.message,
      });
      return;
    }

    this.failureCount++;
    this.successCount = 0;

    logger.warn('Circuit breaker failure', {
      breaker: this.name,
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      error: error.message,
    });

    // Open circuit if threshold reached
    if (
      this.state === CircuitState.HALF_OPEN ||
      this.failureCount >= this.failureThreshold
    ) {
      this.transitionTo(CircuitState.OPEN);
      this.nextAttempt = Date.now() + this.resetTimeout;
      
      logger.error('Circuit breaker opened', {
        breaker: this.name,
        resetAfter: this.resetTimeout,
        failureCount: this.failureCount,
      });
    }
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    
    if (oldState === newState) return;
    
    this.state = newState;
    
    if (this.onStateChange) {
      this.onStateChange(oldState, newState);
    }

    logger.info('Circuit breaker state changed', {
      breaker: this.name,
      from: oldState,
      to: newState,
    });
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit stats
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: new Date(this.nextAttempt),
      lastError: this.lastError?.message,
    };
  }

  /**
   * Manually reset circuit
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastError = undefined;
    
    logger.info('Circuit breaker manually reset', { breaker: this.name });
  }

  /**
   * Manually trip circuit
   */
  trip(): void {
    this.transitionTo(CircuitState.OPEN);
    this.nextAttempt = Date.now() + this.resetTimeout;
    
    logger.warn('Circuit breaker manually tripped', { breaker: this.name });
  }
}

/**
 * Circuit Breaker Registry
 * 
 * Centralized management of circuit breakers across the application
 */
export class CircuitBreakerRegistry {
  private static breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker
   */
  static getOrCreate(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(
        name,
        new CircuitBreaker({ ...options, name })
      );
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  static getAll(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  /**
   * Get circuit breaker stats for all breakers
   */
  static getAllStats() {
    const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
    
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    logger.info('All circuit breakers reset');
  }
}

/**
 * Decorator for automatic circuit breaker protection
 */
export function withCircuitBreaker(options: CircuitBreakerOptions & { name: string }) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const breaker = CircuitBreakerRegistry.getOrCreate(
      options.name,
      options
    );

    descriptor.value = async function (...args: any[]) {
      return breaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

