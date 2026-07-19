/**
 * Embedding Cache Service
 * 
 * Production-grade caching layer for OpenAI embeddings to reduce costs and improve performance.
 * Uses Redis for distributed caching with automatic TTL-based expiration.
 * 
 * Features:
 * - Cache embeddings by text + model combination
 * - SHA-256 hashing for consistent cache keys
 * - Graceful degradation (fail-open) if Redis unavailable
 * - Cache statistics tracking (hits, misses, cost savings)
 * - Configurable TTL (default: 30 days)
 * 
 * Cost Savings:
 * - text-embedding-3-small: $0.00002 per 1K tokens (~$0.02 per 1M tokens)
 * - Each cache hit saves ~$0.00001 per request
 * - At 1000 queries/day: ~$3.65/year savings
 * - At 100k queries/day: ~$365/year savings
 * 
 * Created: February 11, 2026
 */

import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';
import { logger } from '@/lib/logger';

interface CachedEmbedding {
  embedding: number[];
  model: string;
  text: string;
  createdAt: number;
  hits: number;
}

interface EmbeddingCacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  estimatedCostSavings: number; // in dollars
}

// Cost constants (OpenAI pricing as of 2026)
const COST_PER_1K_TOKENS = 0.00002; // text-embedding-3-small
const AVG_TOKENS_PER_REQUEST = 250; // Conservative estimate

// Initialize Redis client (reuse existing Upstash configuration)
const redis = (() => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Only warn if we&apos;re not in test/build environment
    if (process.env.NODE_ENV !== 'test' && !process.env.BUILDING) {
      logger.warn('Redis not configured - embedding cache will be disabled', {
        component: 'embedding-cache',
        message: 'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for caching',
        impact: 'All embedding requests will hit OpenAI API directly',
      });
    }
    return null;
  }

  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
})();

class EmbeddingCacheService {
  private stats: { hits: number; misses: number; requests: number };
  private readonly DEFAULT_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
  private readonly STATS_KEY = 'ai:embedding:cache:stats';
  private readonly CACHE_PREFIX = 'ai:embedding:cache';
  private statsLoaded: boolean = false;

  constructor() {
    this.stats = { hits: 0, misses: 0, requests: 0 };
    // Load stats asynchronously without blocking constructor
    this.loadStats().catch(err => {
      logger.warn('Failed to load initial embedding cache stats', { error: err.message });
    });
  }

  /**
   * Load stats from Redis
   */
  private async loadStats(): Promise<void> {
    if (!redis || this.statsLoaded) return;
    
    try {
      const stats = await redis.get<{ hits: number; misses: number; requests: number }>(this.STATS_KEY);
      if (stats) {
        this.stats = stats;
        this.statsLoaded = true;
        logger.info('Loaded embedding cache stats from Redis', { stats });
      }
    } catch (error) {
      logger.error('Failed to load embedding cache stats from Redis', error as Error);
    }
  }

  /**
   * Save stats to Redis
   */
  private async saveStats(): Promise<void> {
    if (!redis) return;
    
    try {
      await redis.set(this.STATS_KEY, this.stats, { ex: 7 * 24 * 60 * 60 }); // 7 days
    } catch (error) {
      logger.error('Failed to save embedding cache stats to Redis', error as Error);
    }
  }

  /**
   * Generate consistent cache key using SHA-256 hash of text + model
   * This ensures cache keys are identical across app restarts
   */
  private generateCacheKey(text: string, model: string): string {
    // Normalize text (trim whitespace, normalize line endings)
    const normalizedText = text.trim().replace(/\r\n/g, '\n');
    
    // Create hash of normalized text + model
    const hash = createHash('sha256')
      .update(`${normalizedText}:${model}`)
      .digest('hex');
    
    return `${this.CACHE_PREFIX}:${model}:${hash}`;
  }

  /**
   * Get cached embedding if available
   * Returns null if not cached or if Redis unavailable (fail-open)
   */
  async getCachedEmbedding(
    text: string,
    model: string
  ): Promise<number[] | null> {
    // Fail-open: if Redis not configured, return null (proceed with API call)
    if (!redis) {
      return null;
    }
    
    this.stats.requests++;
    const key = this.generateCacheKey(text, model);
    
    try {
      const cached = await redis.get<CachedEmbedding>(key);

      if (!cached) {
        this.stats.misses++;
        await this.saveStats();
        logger.debug('Embedding cache miss', { 
          model, 
          textLength: text.length,
          key: key.substring(0, 50) + '...'
        });
        return null;
      }

      // Update hit count
      cached.hits++;
      this.stats.hits++;
      
      // Update hit count in cache (don&apos;t await to avoid blocking)
      redis.set(key, cached, { ex: this.DEFAULT_TTL }).catch(err => {
        logger.warn('Failed to update embedding cache hit count', { error: err.message });
      });
      
      await this.saveStats();
      
      logger.info('Embedding cache hit', { 
        model, 
        textLength: text.length,
        hits: cached.hits,
        age: Math.round((Date.now() - cached.createdAt) / 1000 / 60), // minutes
      });
      
      return cached.embedding;
    } catch (error) {
      // Fail-open: log error but return null to proceed with API call
      logger.error('Embedding cache get failed - proceeding with API call', error as Error, { 
        key,
        model,
        textLength: text.length
      });
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Store embedding in cache
   * Fails silently if Redis unavailable (fail-open)
   */
  async setCachedEmbedding(
    text: string,
    model: string,
    embedding: number[],
    ttlSeconds?: number
  ): Promise<void> {
    // Fail-open: if Redis not configured, return silently
    if (!redis) {
      return;
    }
    
    const key = this.generateCacheKey(text, model);
    const ttl = ttlSeconds || this.DEFAULT_TTL;
    
    try {
      const cached: CachedEmbedding = {
        embedding,
        model,
        text: text.substring(0, 200), // Store first 200 chars for debugging
        createdAt: Date.now(),
        hits: 0,
      };
      
      await redis.set(key, cached, { ex: ttl });
      
      logger.debug('Embedding cached', { 
        model, 
        textLength: text.length,
        ttlDays: Math.round(ttl / 60 / 60 / 24),
        embeddingSize: embedding.length
      });
    } catch (error) {
      // Fail-open: log error but don&apos;t throw (cache write failure is not critical)
      logger.error('Failed to cache embedding - proceeding without cache', error as Error, { 
        key,
        model,
        textLength: text.length
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<EmbeddingCacheStats> {
    // Ensure we have latest stats
    await this.loadStats();
    
    const hitRate = this.stats.requests > 0 
      ? this.stats.hits / this.stats.requests 
      : 0;
    
    // Calculate estimated cost savings
    // Each cache hit saves one API call
    const savedCalls = this.stats.hits;
    const costPerCall = (AVG_TOKENS_PER_REQUEST / 1000) * COST_PER_1K_TOKENS;
    const estimatedCostSavings = savedCalls * costPerCall;
    
    return {
      totalRequests: this.stats.requests,
      cacheHits: this.stats.hits,
      cacheMisses: this.stats.misses,
      hitRate: Math.round(hitRate * 10000) / 100, // Round to 2 decimals (percentage)
      estimatedCostSavings: Math.round(estimatedCostSavings * 100) / 100, // Round to 2 decimals (dollars)
    };
  }

  /**
   * Clear all embedding cache entries (admin function)
   * WARNING: This will delete ALL cached embeddings
   */
  async clearCache(): Promise<{ deleted: number }> {
    if (!redis) {
      logger.warn('Cannot clear cache - Redis not configured');
      return { deleted: 0 };
    }
    
    try {
      // Use SCAN to find all keys with our prefix
      const keys: string[] = [];
      let cursor = 0;
      
      do {
        const result = await redis.scan(cursor, {
          match: `${this.CACHE_PREFIX}:*`,
          count: 100,
        });
        cursor = result[0] as any as number;
        keys.push(...(result[1] as string[]));
      } while (cursor !== 0);
      
      // Delete all found keys
      if (keys.length > 0) {
        await Promise.all(keys.map(key => redis.del(key)));
      }
      
      logger.warn('Embedding cache cleared', { deletedKeys: keys.length });
      
      return { deleted: keys.length };
    } catch (error) {
      logger.error('Failed to clear embedding cache', error as Error);
      throw new Error('Failed to clear cache');
    }
  }

  /**
   * Reset cache statistics (admin function)
   */
  async resetStats(): Promise<void> {
    this.stats = { hits: 0, misses: 0, requests: 0 };
    await this.saveStats();
    logger.info('Embedding cache stats reset');
  }
}

// Export singleton instance
export const embeddingCache = new EmbeddingCacheService();

// Export types
export type { EmbeddingCacheStats, CachedEmbedding };
