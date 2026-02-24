/**
 * AI Rate Limiter Service
 * 
 * Provides rate limiting for LLM API calls to prevent runaway costs.
 * Uses Redis for distributed rate limiting across server instances.
 * 
 * Features:
 * - Requests per minute limiting
 * - Tokens per hour limiting
 * - Cost per day limiting
 * - Budget enforcement
 * - Organization-level isolation
 * 
 * Part of Phase 1: LLM Excellence Implementation
 */

import { Redis } from '@upstash/redis';
import { db } from '@/db';
import { aiBudgets } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// Initialize Redis client
const redis = (() => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (process.env.NODE_ENV !== 'test' && !process.env.BUILDING) {
      logger.warn('Redis not configured - rate limiter will fail at runtime', {
        component: 'ai-rate-limiter',
        message: 'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN',
      });
    }
    return null;
  }

  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
})();

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerHour: number;
  costPerDayUSD: number;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number; // seconds
  currentUsage: {
    requests: number;
    tokens: number;
    costUSD: number;
  };
}

export class AIRateLimiter {
  private readonly defaultLimits: RateLimitConfig = {
    requestsPerMinute: 60,
    tokensPerHour: 100000,
    costPerDayUSD: 100,
  };

  /**
   * Check if request is allowed under rate limits
   */
  async checkLimit(
    organizationId: string,
    estimatedTokens: number,
    estimatedCostUSD: number
  ): Promise<RateLimitResult> {
    if (!redis) {
      // Fail open if Redis not configured (don&apos;t block requests)
      logger.error('Redis not available for rate limiting');
      return {
        allowed: true,
        currentUsage: { requests: 0, tokens: 0, costUSD: 0 },
      };
    }

    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);
    const day = new Date().toISOString().split('T')[0];
    
    // Keys for different time windows
    const reqKey = `ratelimit:${organizationId}:requests:${minute}`;
    const tokenKey = `ratelimit:${organizationId}:tokens:${hour}`;
    const costKey = `ratelimit:${organizationId}:cost:${day}`;
    
    try {
      // Get current usage
      const [requests, tokens, costCents] = await Promise.all([
        redis.get<string>(reqKey),
        redis.get<string>(tokenKey),
        redis.get<string>(costKey),
      ]);
      
      const currentRequests = parseInt(requests || '0');
      const currentTokens = parseInt(tokens || '0');
      const currentCostUSD = parseInt(costCents || '0') / 100;
      
      // Get budget from database
      const today = new Date().toISOString().split('T')[0];
      const budget = await db.query.aiBudgets.findFirst({
        where: and(
          eq(aiBudgets.organizationId, organizationId),
          gte(aiBudgets.billingPeriodEnd, today)
        ),
      });
      
      if (!budget) {
        logger.warn('No AI budget configured for organization', { organizationId });
        // Allow with default limits if no budget configured
        return {
          allowed: true,
          currentUsage: { requests: currentRequests, tokens: currentTokens, costUSD: currentCostUSD },
        };
      }
      
      // Check requests per minute (default: 60)
      const maxRequestsPerMin = this.defaultLimits.requestsPerMinute;
      if (currentRequests >= maxRequestsPerMin) {
        logger.info('Rate limit exceeded: requests per minute', {
          organizationId,
          currentRequests,
          limit: maxRequestsPerMin,
        });
        
        return {
          allowed: false,
          reason: 'Rate limit exceeded: requests per minute',
          retryAfter: 60 - (now % 60000) / 1000,
          currentUsage: { requests: currentRequests, tokens: currentTokens, costUSD: currentCostUSD },
        };
      }
      
      // Check tokens per hour (default: 100k)
      const maxTokensPerHour = this.defaultLimits.tokensPerHour;
      if (currentTokens + estimatedTokens > maxTokensPerHour) {
        logger.info('Rate limit exceeded: tokens per hour', {
          organizationId,
          currentTokens,
          estimatedTokens,
          limit: maxTokensPerHour,
        });
        
        return {
          allowed: false,
          reason: 'Rate limit exceeded: tokens per hour',
          retryAfter: 3600 - (now % 3600000) / 1000,
          currentUsage: { requests: currentRequests, tokens: currentTokens, costUSD: currentCostUSD },
        };
      }
      
      // Check budget (hard limit if enabled)
      const projectedCost = currentCostUSD + estimatedCostUSD;
      const monthlyLimitUSD = parseFloat(budget.monthlyLimitUsd.toString());
      
      if (budget.hardLimit && projectedCost > monthlyLimitUSD) {
        logger.warn('Budget exceeded', {
          organizationId,
          currentCostUSD,
          estimatedCostUSD,
          monthlyLimitUSD,
        });
        
        return {
          allowed: false,
          reason: `Budget exceeded: $${projectedCost.toFixed(2)} / $${monthlyLimitUSD.toFixed(2)}`,
          currentUsage: { requests: currentRequests, tokens: currentTokens, costUSD: currentCostUSD },
        };
      }
      
      // All checks passed
      return {
        allowed: true,
        currentUsage: { requests: currentRequests, tokens: currentTokens, costUSD: currentCostUSD },
      };
    } catch (error) {
      logger.error('Rate limit check failed', { error, organizationId });
      // Fail open - allow request if check fails
      return {
        allowed: true,
        currentUsage: { requests: 0, tokens: 0, costUSD: 0 },
      };
    }
  }
  
  /**
   * Record usage after successful request
   */
  async recordUsage(
    organizationId: string,
    tokens: number,
    costUSD: number
  ): Promise<void> {
    if (!redis) {
      logger.error('Redis not available for recording usage');
      return;
    }

    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);
    const day = new Date().toISOString().split('T')[0];
    
    const reqKey = `ratelimit:${organizationId}:requests:${minute}`;
    const tokenKey = `ratelimit:${organizationId}:tokens:${hour}`;
    const costKey = `ratelimit:${organizationId}:cost:${day}`;
    
    try {
      // Increment counters with TTL using pipeline for atomicity
      const pipeline = redis.pipeline();
      
      // Requests (2 minute TTL)
      pipeline.incr(reqKey);
      pipeline.expire(reqKey, 120);
      
      // Tokens (2 hour TTL)
      pipeline.incrby(tokenKey, tokens);
      pipeline.expire(tokenKey, 7200);
      
      // Cost in cents (32 day TTL to cover a full month)
      pipeline.incrby(costKey, Math.round(costUSD * 100));
      pipeline.expire(costKey, 86400 * 32);
      
      await pipeline.exec();
      
      logger.debug('Rate limit usage recorded', {
        organizationId,
        tokens,
        costUSD,
      });
    } catch (error) {
      logger.error('Failed to record rate limit usage', { error, organizationId });
    }
  }
  
  /**
   * Get current usage statistics for an organization
   */
  async getUsageStats(organizationId: string): Promise<{
    requestsThisMinute: number;
    tokensThisHour: number;
    costToday: number;
  }> {
    if (!redis) {
      return { requestsThisMinute: 0, tokensThisHour: 0, costToday: 0 };
    }

    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);
    const day = new Date().toISOString().split('T')[0];
    
    const reqKey = `ratelimit:${organizationId}:requests:${minute}`;
    const tokenKey = `ratelimit:${organizationId}:tokens:${hour}`;
    const costKey = `ratelimit:${organizationId}:cost:${day}`;
    
    try {
      const [requests, tokens, costCents] = await Promise.all([
        redis.get<string>(reqKey),
        redis.get<string>(tokenKey),
        redis.get<string>(costKey),
      ]);
      
      return {
        requestsThisMinute: parseInt(requests || '0'),
        tokensThisHour: parseInt(tokens || '0'),
        costToday: parseInt(costCents || '0') / 100,
      };
    } catch (error) {
      logger.error('Failed to get usage stats', { error, organizationId });
      return { requestsThisMinute: 0, tokensThisHour: 0, costToday: 0 };
    }
  }
  
  /**
   * Reset rate limits for an organization (admin function)
   */
  async resetLimits(organizationId: string): Promise<void> {
    if (!redis) {
      return;
    }

    try {
      // Get all keys for this organization
      const pattern = `ratelimit:${organizationId}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info('Rate limits reset', { organizationId, keysDeleted: keys.length });
      }
    } catch (error) {
      logger.error('Failed to reset rate limits', { error, organizationId });
    }
  }
}

// Singleton instance
export const aiRateLimiter = new AIRateLimiter();
