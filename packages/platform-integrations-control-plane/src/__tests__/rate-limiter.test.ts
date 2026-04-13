/**
 * Rate Limiter — Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { IntegrationRateLimiter } from '../rate-limiter'

describe('IntegrationRateLimiter', () => {
  let limiter: IntegrationRateLimiter

  beforeEach(() => {
    limiter = new IntegrationRateLimiter()
  })

  it('allows requests when no config is set', () => {
    const result = limiter.checkAndRecord('org-1', 'slack')
    expect(result.isThrottled).toBe(false)
  })

  it('status() returns zero counts when no window state exists', () => {
    const status = limiter.status('org-1', 'slack')

    expect(status.currentMinuteCount).toBe(0)
    expect(status.currentHourCount).toBe(0)
    expect(status.isThrottled).toBe(false)
  })

  it('allows requests within rate limits', () => {
    limiter.configure({
      orgId: 'org-1',
      provider: 'slack',
      maxRequestsPerMinute: 10,
      maxRequestsPerHour: 100,
      burstLimit: 5,
    })

    const result = limiter.checkAndRecord('org-1', 'slack')
    expect(result.isThrottled).toBe(false)
    expect(result.currentMinuteCount).toBe(1)
  })

  it('throttles when minute limit is exceeded', () => {
    limiter.configure({
      orgId: 'org-1',
      provider: 'slack',
      maxRequestsPerMinute: 3,
      maxRequestsPerHour: 100,
      burstLimit: 5,
    })

    limiter.checkAndRecord('org-1', 'slack')
    limiter.checkAndRecord('org-1', 'slack')
    limiter.checkAndRecord('org-1', 'slack')

    const result = limiter.checkAndRecord('org-1', 'slack')
    expect(result.isThrottled).toBe(true)
  })

  it('isolates rate limits between org+provider combos', () => {
    limiter.configure({
      orgId: 'org-1',
      provider: 'slack',
      maxRequestsPerMinute: 2,
      maxRequestsPerHour: 100,
      burstLimit: 5,
    })
    limiter.configure({
      orgId: 'org-2',
      provider: 'slack',
      maxRequestsPerMinute: 2,
      maxRequestsPerHour: 100,
      burstLimit: 5,
    })

    limiter.checkAndRecord('org-1', 'slack')
    limiter.checkAndRecord('org-1', 'slack')

    // org-1 is throttled
    expect(limiter.checkAndRecord('org-1', 'slack').isThrottled).toBe(true)
    // org-2 is not throttled
    expect(limiter.checkAndRecord('org-2', 'slack').isThrottled).toBe(false)
  })

  it('status() returns current state without recording', () => {
    limiter.configure({
      orgId: 'org-1',
      provider: 'slack',
      maxRequestsPerMinute: 10,
      maxRequestsPerHour: 100,
      burstLimit: 5,
    })

    limiter.checkAndRecord('org-1', 'slack')
    const status = limiter.status('org-1', 'slack')

    expect(status.currentMinuteCount).toBe(1)
    expect(status.isThrottled).toBe(false)
  })

  it('status() does not throttle when config is missing but window state exists', () => {
    limiter.configure({
      orgId: 'org-1',
      provider: 'slack',
      maxRequestsPerMinute: 1,
      maxRequestsPerHour: 1,
      burstLimit: 1,
    })

    limiter.checkAndRecord('org-1', 'slack')
    ;(limiter as unknown as { configs: Map<string, unknown> }).configs.clear()

    const status = limiter.status('org-1', 'slack')
    expect(status.currentMinuteCount).toBe(1)
    expect(status.currentHourCount).toBe(1)
    expect(status.isThrottled).toBe(false)
  })

  it('reset() clears state for an org+provider', () => {
    limiter.configure({
      orgId: 'org-1',
      provider: 'slack',
      maxRequestsPerMinute: 2,
      maxRequestsPerHour: 100,
      burstLimit: 5,
    })

    limiter.checkAndRecord('org-1', 'slack')
    limiter.checkAndRecord('org-1', 'slack')
    limiter.reset('org-1', 'slack')

    const result = limiter.checkAndRecord('org-1', 'slack')
    expect(result.isThrottled).toBe(false)
    expect(result.currentMinuteCount).toBe(1)
  })

  it('clear() removes all state', () => {
    limiter.configure({
      orgId: 'org-1',
      provider: 'slack',
      maxRequestsPerMinute: 1,
      maxRequestsPerHour: 100,
      burstLimit: 5,
    })

    limiter.checkAndRecord('org-1', 'slack')
    limiter.clear()

    // No config = no limits
    const result = limiter.checkAndRecord('org-1', 'slack')
    expect(result.isThrottled).toBe(false)
  })
})
