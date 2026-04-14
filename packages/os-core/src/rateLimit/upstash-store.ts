/**
 * @nzila/os-core — Upstash Redis REST Rate Limit Store
 *
 * Edge Runtime compatible — uses only `fetch()`, no Node.js-specific imports.
 * Implements the same `RateLimitStore` interface as the ioredis-backed store.
 *
 * Env vars:
 *   UPSTASH_REDIS_REST_URL   — e.g. https://us1-xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — Bearer token
 *
 * @module @nzila/os-core/rateLimit/upstash-store
 */

import type { RateLimitStore, RateLimitStoreResult } from './store'

interface UpstashPipelineResult {
  result: unknown
  error?: string
}

export class UpstashRateLimitStore implements RateLimitStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly prefix = 'nzila:rl:',
  ) {}

  async hit(key: string, windowMs: number, max: number): Promise<RateLimitStoreResult> {
    const redisKey = `${this.prefix}${key}`
    const now = Date.now()
    const windowStart = now - windowMs
    const member = `${now}:${Math.random().toString(36).slice(2, 8)}`

    // Phase 1: Purge expired entries + check count
    const checkResults = await this.pipeline([
      ['ZREMRANGEBYSCORE', redisKey, '0', String(windowStart)],
      ['ZCARD', redisKey],
    ])

    const currentCount = Number(checkResults[1]?.result ?? 0)

    if (currentCount >= max) {
      return {
        count: currentCount,
        allowed: false,
        remaining: 0,
        resetAt: now + windowMs,
      }
    }

    // Phase 2: Record the new hit + set TTL
    await this.pipeline([
      ['ZADD', redisKey, String(now), member],
      ['PEXPIRE', redisKey, String(windowMs)],
    ])

    return {
      count: currentCount + 1,
      allowed: true,
      remaining: max - (currentCount + 1),
      resetAt: now + windowMs,
    }
  }

  async reset(key: string): Promise<void> {
    await this.pipeline([['DEL', `${this.prefix}${key}`]])
  }

  async peek(key: string, windowMs: number): Promise<number> {
    const redisKey = `${this.prefix}${key}`
    const now = Date.now()
    const windowStart = now - windowMs

    const results = await this.pipeline([
      ['ZREMRANGEBYSCORE', redisKey, '0', String(windowStart)],
      ['ZCARD', redisKey],
    ])

    return Number(results[1]?.result ?? 0)
  }

  async healthy(): Promise<boolean> {
    try {
      const results = await this.pipeline([['PING']])
      return results[0]?.result === 'PONG'
    } catch {
      return false
    }
  }

  private async pipeline(commands: string[][]): Promise<UpstashPipelineResult[]> {
    const res = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    })

    if (!res.ok) {
      throw new Error(`Upstash pipeline failed: ${res.status} ${res.statusText}`)
    }

    return (await res.json()) as UpstashPipelineResult[]
  }
}
