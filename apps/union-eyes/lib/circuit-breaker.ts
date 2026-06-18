/**
 * Circuit Breaker Pattern Implementation
 * 
 * Provides resilience for external service calls (Redis, APIs, databases)
 * Prevents cascade failures by failing fast when a service is unavailable
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests pass
 * 
 * Usage:
 *   const breaker = new CircuitBreaker('redis', { threshold: 5, timeout: 60000 });
 *   const result = await breaker.execute(() => redis.get(key));
 */

import { logger } from './logger';
export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  threshold: number;
  
  /** Time in ms to wait before attempting reset (OPEN → HALF_OPEN) */
  timeout: number;
  
  /** Number of successful requests in HALF_OPEN before closing */
  successThreshold?: number;
  
  /** Fallback value/function when circuit is open */
  fallback?: any;
  
  /** Custom error detector - return true if error should count as failure */
  isFailure?: (error: Error) => boolean;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

/**
 * Circuit Breaker for external service calls
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttemptTime?: number;
  
  // Statistics
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {
    this.config.successThreshold = config.successThreshold || 2;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // If circuit is OPEN, check if we should try HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (this.nextAttemptTime && now < this.nextAttemptTime) {
        // Circuit still open, fail fast
        throw new CircuitBreakerOpenError(
          `Circuit breaker '${this.name}' is OPEN`,
          this.getStats()
        );
      }
      
      // Timeout elapsed, try HALF_OPEN
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      logger.info(`Circuit breaker '${this.name}' entering HALF_OPEN state`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute with fallback value when circuit is open
   */
  async executeWithFallback<T>(
    fn: () => Promise<T>,
    fallback: T | (() => T)
  ): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        logger.warn(`Circuit breaker '${this.name}' open, using fallback`, {
          stats: this.getStats(),
        });
        return typeof fallback === 'function' ? (fallback as () => T)() : fallback;
      }
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();
    this.failureCount = 0; // Reset failure count on success

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= (this.config.successThreshold || 2)) {
        // Enough successes, close the circuit
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info(`Circuit breaker '${this.name}' closed after recovery`, {
          stats: this.getStats(),
        });
      }
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(error: Error): void {
    // Check if this error should count as a failure
    if (this.config.isFailure && !this.config.isFailure(error)) {
      return; // Don&apos;t count this as a circuit breaker failure
    }

    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    logger.warn(`Circuit breaker '${this.name}' recorded failure`, {
      error: error.message,
      failureCount: this.failureCount,
      threshold: this.config.threshold,
      state: this.state,
    });

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed in HALF_OPEN, go back to OPEN
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.timeout;
      logger.error(`Circuit breaker '${this.name}' reopened after failure in HALF_OPEN`, {
        stats: this.getStats(),
      });
    } else if (this.failureCount >= this.config.threshold) {
      // Threshold exceeded, open the circuit
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.timeout;
      logger.error(`Circuit breaker '${this.name}' opened due to failures`, {
        stats: this.getStats(),
      });
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Manually reset the circuit breaker (admin/debugging)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = undefined;
    logger.info(`Circuit breaker '${this.name}' manually reset`);
  }

  /**
   * Check if circuit is currently open (failing fast)
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Force circuit open (for testing or manual intervention)
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.timeout;
    logger.warn(`Circuit breaker '${this.name}' manually forced open`);
  }
}

/**
 * Custom error thrown when circuit is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    message: string,
    public stats: CircuitBreakerStats
  ) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Global circuit breaker registry
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker
   */
  get(name: string, config: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach((breaker) => breaker.reset());
    logger.info('All circuit breakers reset');
  }
}

// Global registry instance
export const circuitBreakers = new CircuitBreakerRegistry();

/**
 * Predefined circuit breakers for common services
 */
export const CIRCUIT_BREAKERS = {
  REDIS: {
    threshold: 5,        // 5 failures before opening
    timeout: 30000,      // 30 seconds before retry
    successThreshold: 2, // 2 successes to close
  },
  
  DATABASE: {
    threshold: 3,        // 3 failures (more sensitive)
    timeout: 60000,      // 1 minute before retry
    successThreshold: 3, // 3 successes to close
  },
  
  EXTERNAL_API: {
    threshold: 5,
    timeout: 60000,      // 1 minute
    successThreshold: 2,
  },
  
  SENTRY: {
    threshold: 10,       // Allow more failures for logging service
    timeout: 120000,     // 2 minutes
    successThreshold: 3,
  },
};
