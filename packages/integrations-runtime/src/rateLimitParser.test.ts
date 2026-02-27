import { describe, it, expect } from 'vitest'
import {
  parseSlackRateLimit,
  parseHubSpotRateLimit,
  parseTeamsRateLimit,
  parseGenericRateLimit,
  parseRateLimitInfo,
} from './rateLimitParser'

describe('Rate Limit Parsers', () => {
  describe('parseSlackRateLimit', () => {
    it('returns not rate-limited for non-429 status', () => {
      const result = parseSlackRateLimit(200, {})
      expect(result.isRateLimited).toBe(false)
    })

    it('parses 429 with retry-after header (seconds)', () => {
      const result = parseSlackRateLimit(429, { 'retry-after': '10' })
      expect(result.isRateLimited).toBe(true)
      expect(result.retryAfterMs).toBe(10_000)
    })

    it('defaults retryAfterMs to 30s when header missing', () => {
      const result = parseSlackRateLimit(429, {})
      expect(result.isRateLimited).toBe(true)
      expect(result.retryAfterMs).toBe(30_000)
    })

    it('caps retry-after at 5 minutes', () => {
      const result = parseSlackRateLimit(429, { 'retry-after': '600' })
      expect(result.retryAfterMs).toBeLessThanOrEqual(5 * 60 * 1000)
    })
  })

  describe('parseHubSpotRateLimit', () => {
    it('returns not rate-limited for non-429 status', () => {
      const result = parseHubSpotRateLimit(200, {})
      expect(result.isRateLimited).toBe(false)
    })

    it('parses 429 with HubSpot daily limit headers', () => {
      const result = parseHubSpotRateLimit(429, {
        'retry-after': '5',
        'x-hubspot-ratelimit-daily': '100000',
        'x-hubspot-ratelimit-daily-remaining': '50',
      })
      expect(result.isRateLimited).toBe(true)
      expect(result.retryAfterMs).toBe(5_000)
      expect(result.limit).toBe(100_000)
      expect(result.remaining).toBe(50)
    })

    it('defaults retryAfterMs to 10s when header missing', () => {
      const result = parseHubSpotRateLimit(429, {})
      expect(result.retryAfterMs).toBe(10_000)
    })
  })

  describe('parseTeamsRateLimit', () => {
    it('returns not rate-limited for non-429', () => {
      const result = parseTeamsRateLimit(200, {})
      expect(result.isRateLimited).toBe(false)
    })

    it('parses 429 with retry-after', () => {
      const result = parseTeamsRateLimit(429, { 'retry-after': '15' })
      expect(result.isRateLimited).toBe(true)
      expect(result.retryAfterMs).toBe(15_000)
    })

    it('defaults to 60s for Teams without retry-after', () => {
      const result = parseTeamsRateLimit(429, {})
      expect(result.retryAfterMs).toBe(60_000)
    })
  })

  describe('parseGenericRateLimit', () => {
    it('returns not rate-limited for non-429', () => {
      const result = parseGenericRateLimit(200, {})
      expect(result.isRateLimited).toBe(false)
    })

    it('parses standard X-RateLimit headers', () => {
      const result = parseGenericRateLimit(429, {
        'retry-after': '3',
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1740700000',
      })
      expect(result.isRateLimited).toBe(true)
      expect(result.retryAfterMs).toBe(3_000)
      expect(result.limit).toBe(1000)
      expect(result.remaining).toBe(0)
      expect(result.resetAt).toMatch(/^\d{4}-\d{2}/)
    })

    it('defaults retryAfterMs to 30s when header missing', () => {
      const result = parseGenericRateLimit(429, {})
      expect(result.retryAfterMs).toBe(30_000)
    })
  })

  describe('parseRateLimitInfo — unified dispatcher entry', () => {
    it('routes to Slack parser', () => {
      const result = parseRateLimitInfo('slack', 429, { 'retry-after': '5' })
      expect(result.isRateLimited).toBe(true)
      expect(result.retryAfterMs).toBe(5_000)
    })

    it('routes to HubSpot parser', () => {
      const result = parseRateLimitInfo('hubspot', 429, { 'retry-after': '2' })
      expect(result.isRateLimited).toBe(true)
      expect(result.retryAfterMs).toBe(2_000)
    })

    it('routes to Teams parser', () => {
      const result = parseRateLimitInfo('teams', 429, {})
      expect(result.isRateLimited).toBe(true)
      expect(result.retryAfterMs).toBe(60_000)
    })

    it('falls back to generic for unknown provider', () => {
      const result = parseRateLimitInfo('unknown_provider', 429, { 'retry-after': '7' })
      expect(result.isRateLimited).toBe(true)
      expect(result.retryAfterMs).toBe(7_000)
    })

    it('returns not rate-limited for 200 response', () => {
      const result = parseRateLimitInfo('resend', 200, {})
      expect(result.isRateLimited).toBe(false)
    })
  })
})
