/**
 * Chaos Engineering Framework
 * 
 * Controlled fault injection for testing system resilience:
 * - Latency injection
 * - Error injection
 * - Resource exhaustion
 * - Network failures
 * - Database failures
 * 
 * Usage:
 *   const chaos = new ChaosMonkey({ enabled: true });
 *   chaos.injectLatency({ probability: 0.1, minMs: 100, maxMs: 500 });
 */

 
import { logger } from '@/lib/logger';

export interface ChaosConfig {
  enabled: boolean;
  environment?: 'development' | 'staging' | 'production';
  seed?: number;
}

export interface LatencyConfig {
  probability: number;  // 0.0 to 1.0
  minMs: number;
  maxMs: number;
}

export interface ErrorConfig {
  probability: number;  // 0.0 to 1.0
  errorCode?: number;
  errorMessage?: string;
}

export interface ResourceConfig {
  probability: number;  // 0.0 to 1.0
  type: 'memory' | 'cpu' | 'disk';
  durationMs?: number;
}

export class ChaosError extends Error {
  constructor(
    message: string,
    public readonly code: number = 500,
    public readonly chaosType: string = 'unknown'
  ) {
    super(message);
    this.name = 'ChaosError';
  }
}

export class ChaosMonkey {
  private enabled: boolean;
  private environment: string;
  private random: () => number;

  constructor(config: ChaosConfig) {
    this.enabled = config.enabled;
    this.environment = config.environment || 'development';
    
    // Use seeded random for reproducible chaos
    if (config.seed !== undefined) {
      this.random = this.seededRandom(config.seed);
    } else {
      this.random = Math.random;
    }

    logger.info('ChaosMonkey initialized', {
      enabled: this.enabled,
      environment: this.environment,
    });
  }

  /**
   * Seeded random number generator for reproducible chaos
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  /**
   * Check if chaos should be injected based on probability
   */
  private shouldInject(probability: number): boolean {
    if (!this.enabled) return false;
    return this.random() < probability;
  }

  /**
   * Inject random latency
   */
  async injectLatency(config: LatencyConfig): Promise<void> {
    if (!this.shouldInject(config.probability)) return;

    const latency = Math.floor(
      config.minMs + this.random() * (config.maxMs - config.minMs)
    );

    logger.warn('Chaos: Injecting latency', { latencyMs: latency });

    await new Promise((resolve) => setTimeout(resolve, latency));
  }

  /**
   * Inject random errors
   */
  injectError(config: ErrorConfig): void {
    if (!this.shouldInject(config.probability)) return;

    const code = config.errorCode || 500;
    const message = config.errorMessage || 'Chaos-induced error';

    logger.warn('Chaos: Injecting error', { code, message });

    throw new ChaosError(message, code, 'error-injection');
  }

  /**
   * Inject network failure
   */
  injectNetworkFailure(probability: number = 0.1): void {
    if (!this.shouldInject(probability)) return;

    logger.warn('Chaos: Injecting network failure');

    throw new ChaosError(
      'Network request failed',
      503,
      'network-failure'
    );
  }

  /**
   * Inject database failure
   */
  injectDatabaseFailure(probability: number = 0.1): void {
    if (!this.shouldInject(probability)) return;

    logger.warn('Chaos: Injecting database failure');

    throw new ChaosError(
      'Database connection lost',
      500,
      'database-failure'
    );
  }

  /**
   * Inject resource exhaustion
   */
  async injectResourceExhaustion(config: ResourceConfig): Promise<void> {
    if (!this.shouldInject(config.probability)) return;

    const duration = config.durationMs || 5000;

    logger.warn('Chaos: Injecting resource exhaustion', {
      type: config.type,
      durationMs: duration,
    });

    switch (config.type) {
      case 'memory':
        this.exhaustMemory(duration);
        break;
      case 'cpu':
        this.exhaustCpu(duration);
        break;
      case 'disk':
        logger.warn('Disk exhaustion not implemented');
        break;
    }
  }

  /**
   * Exhaust memory temporarily
   */
  private exhaustMemory(durationMs: number): void {
    const arrays: number[][] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < durationMs) {
      arrays.push(new Array(1000000).fill(Math.random()));
      
      // Prevent complete OOM
      if (arrays.length > 100) {
        arrays.shift();
      }
    }
  }

  /**
   * Exhaust CPU temporarily
   */
  private exhaustCpu(durationMs: number): void {
    const startTime = Date.now();
     
    let _sum = 0;

    while (Date.now() - startTime < durationMs) {
      _sum += Math.random() * Math.random();
    }
  }

  /**
   * Enable chaos
   */
  enable(): void {
    this.enabled = true;
    logger.info('ChaosMonkey enabled');
  }

  /**
   * Disable chaos
   */
  disable(): void {
    this.enabled = false;
    logger.info('ChaosMonkey disabled');
  }

  /**
   * Check if chaos is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Global chaos instance (disabled by default)
 */
export const chaos = new ChaosMonkey({
  enabled: process.env.CHAOS_ENABLED === 'true',
  environment: (process.env.NODE_ENV || 'development') as ChaosConfig['environment'],
  seed: process.env.CHAOS_SEED ? parseInt(process.env.CHAOS_SEED) : undefined,
});

/**
 * Chaos middleware for API routes
 */
export async function chaosMiddleware(): Promise<void> {
  // Inject latency (10% chance, 100-500ms)
  await chaos.injectLatency({
    probability: 0.1,
    minMs: 100,
    maxMs: 500,
  });

  // Inject errors (5% chance)
  chaos.injectError({
    probability: 0.05,
    errorCode: 500,
    errorMessage: 'Chaos-induced internal error',
  });

  // Inject network failures (2% chance)
  chaos.injectNetworkFailure(0.02);
}

