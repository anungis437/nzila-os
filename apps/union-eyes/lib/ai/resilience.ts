/**
 * AI Service Resilience Layer
 * 
 * Provides circuit breaker, rate limiting, and fallback mechanisms
 * for production-grade AI reliability
 */

import { logger } from '@/lib/logger';

// Circuit Breaker States
enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // ms
  monitoringPeriod: number; // ms
}

interface CircuitBreakerStats {
  failures: number;
  successes: number;
  lastFailure: number | null;
  lastSuccess: number | null;
  state: CircuitState;
}

/**
 * Circuit Breaker for AI Services
 */
class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private stats: CircuitBreakerStats;
  private state: CircuitState = CircuitState.CLOSED;
  private nextAttempt: number = 0;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 3,
      timeout: config.timeout ?? 30000, // 30 seconds
      monitoringPeriod: config.monitoringPeriod ?? 60000, // 1 minute
    };

    this.stats = {
      failures: 0,
      successes: 0,
      lastFailure: null,
      lastSuccess: null,
      state: CircuitState.CLOSED,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() >= this.nextAttempt) {
        this.transitionToHalfOpen();
      } else {
        logger.warn('Circuit breaker OPEN, using fallback', {
          nextAttempt: this.nextAttempt,
        });
        if (fallback) return fallback();
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback && this.state === CircuitState.OPEN) {
        return fallback();
      }
      throw error;
    }
  }

  /**
   * Check if circuit allows requests
   */
  isAvailable(): boolean {
    return this.state !== CircuitState.OPEN;
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get stats
   */
  getStats(): CircuitBreakerStats {
    return { ...this.stats };
  }

  private onSuccess(): void {
    this.stats.successes++;
    this.stats.lastSuccess = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.stats.successes >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }

    // Reset failure count on success in closed state
    if (this.state === CircuitState.CLOSED) {
      this.stats.failures = 0;
    }
  }

  private onFailure(): void {
    this.stats.failures++;
    this.stats.lastFailure = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    } else if (this.state === CircuitState.CLOSED) {
      if (this.stats.failures >= this.config.failureThreshold) {
        this.transitionToOpen();
      }
    }
  }

  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.stats.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.config.timeout;
    logger.error('Circuit breaker OPEN', {
      failures: this.stats.failures,
      threshold: this.config.failureThreshold,
    });
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.stats.state = CircuitState.HALF_OPEN;
    this.stats.successes = 0;
    logger.info('Circuit breaker HALF_OPEN');
  }

  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.stats.state = CircuitState.CLOSED;
    this.stats.failures = 0;
    this.stats.successes = 0;
    logger.info('Circuit breaker CLOSED');
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.stats = {
      failures: 0,
      successes: 0,
      lastFailure: null,
      lastSuccess: null,
      state: CircuitState.CLOSED,
    };
    this.nextAttempt = 0;
  }
}

// Rate Limiter
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

interface _RateLimitEntry {
  count: number;
  resetTime: number;
}

class TokenBucketRateLimiter {
  private tokens: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private config: {
    capacity: number;
    refillRate: number; // tokens per second
    windowMs: number;
  };

  constructor(config: { capacity: number; refillRate: number; windowMs: number }) {
    this.config = config;
  }

  /**
   * Try to consume tokens
   */
  tryConsume(key: string, cost: number = 1): boolean {
    this.refill(key);
    
    const bucket = this.tokens.get(key);
    if (!bucket) return false;
    
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return true;
    }
    
    return false;
  }

  /**
   * Get remaining tokens
   */
  getRemaining(key: string): number {
    this.refill(key);
    return this.tokens.get(key)?.tokens ?? 0;
  }

  /**
   * Get reset time
   */
  getResetTime(key: string): number {
    const bucket = this.tokens.get(key);
    if (!bucket) return Date.now() + this.config.windowMs;
    return bucket.lastRefill + this.config.windowMs;
  }

  private refill(key: string): void {
    const now = Date.now();
    let bucket = this.tokens.get(key);
    
    if (!bucket) {
      bucket = { tokens: this.config.capacity, lastRefill: now };
      this.tokens.set(key, bucket);
      return;
    }

    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = (timePassed / 1000) * this.config.refillRate;
    
    bucket.tokens = Math.min(this.config.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.tokens.entries()) {
      if (bucket.lastRefill + this.config.windowMs < now) {
        this.tokens.delete(key);
      }
    }
  }
}

// AI Service Resilience Manager
interface ResilienceConfig {
  circuitBreaker: Partial<CircuitBreakerConfig>;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  fallback: {
    enabled: boolean;
    response?: string;
  };
}

class AIServiceResilience {
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: TokenBucketRateLimiter;
  private config: ResilienceConfig;
  private fallbackResponse: string;

  constructor(config: Partial<ResilienceConfig> = {}) {
    this.config = {
      circuitBreaker: config.circuitBreaker ?? {},
      rateLimit: config.rateLimit ?? {
        windowMs: 60000,
        maxRequests: 100,
      },
      fallback: config.fallback ?? { enabled: true },
    };

    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
    
    // 100 requests per minute = ~1.67 tokens/second
    this.rateLimiter = new TokenBucketRateLimiter({
      capacity: config.rateLimit?.maxRequests ?? 100,
      refillRate: 1.67,
      windowMs: config.rateLimit?.windowMs ?? 60000,
    });

    this.fallbackResponse = config.fallback?.response ?? 
      'I apologize, but I\'m currently experiencing high demand. Please try again in a moment.';
  }

  /**
   * Execute an AI operation with full resilience
   */
  async execute<T>(
    operation: () => Promise<T>,
    identifier: string
  ): Promise<T> {
    // Check rate limit
    if (!this.rateLimiter.tryConsume(identifier)) {
      logger.warn('Rate limit exceeded', { identifier });
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Check circuit breaker
    if (!this.circuitBreaker.isAvailable()) {
      logger.warn('Circuit breaker open', { identifier });
      throw new Error('Service temporarily unavailable');
    }

    // Execute with circuit breaker
    const fallback = this.config.fallback.enabled 
      ? () => Promise.resolve({} as T)
      : undefined;

    return this.circuitBreaker.execute(operation, fallback);
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(identifier: string): {
    remaining: number;
    resetTime: number;
    limited: boolean;
  } {
    const remaining = this.rateLimiter.getRemaining(identifier);
    const resetTime = this.rateLimiter.getResetTime(identifier);
    
    return {
      remaining,
      resetTime,
      limited: remaining <= 0,
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): {
    state: string;
    failures: number;
    successes: number;
  } {
    const stats = this.circuitBreaker.getStats();
    return {
      state: stats.state,
      failures: stats.failures,
      successes: stats.successes,
    };
  }

  /**
   * Reset circuit breaker (for manual recovery)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }
}

// Export singleton instance
export const aiResilience = new AIServiceResilience();

// Export classes for testing
export { CircuitBreaker, TokenBucketRateLimiter, CircuitState };
export type { CircuitBreakerConfig, CircuitBreakerStats, RateLimitConfig };
