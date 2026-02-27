import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ChaosSimulator, isChaosAllowed, CHAOS_SCENARIOS, type ChaosPorts } from './chaos'

const originalEnv = { ...process.env }

function makePorts(overrides?: Partial<ChaosPorts>): ChaosPorts {
  return {
    emitAudit: vi.fn(),
    random: () => 0.5,
    ...overrides,
  }
}

describe('isChaosAllowed', () => {
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns false when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production'
    process.env.INTEGRATIONS_CHAOS_MODE = 'true'
    expect(isChaosAllowed()).toBe(false)
  })

  it('returns false when VERCEL_ENV is production', () => {
    process.env.NODE_ENV = 'development'
    process.env.VERCEL_ENV = 'production'
    process.env.INTEGRATIONS_CHAOS_MODE = 'true'
    expect(isChaosAllowed()).toBe(false)
  })

  it('returns false when AZURE_FUNCTIONS_ENVIRONMENT is Production', () => {
    process.env.NODE_ENV = 'development'
    process.env.AZURE_FUNCTIONS_ENVIRONMENT = 'Production'
    process.env.INTEGRATIONS_CHAOS_MODE = 'true'
    expect(isChaosAllowed()).toBe(false)
  })

  it('returns false when INTEGRATIONS_CHAOS_MODE is not set', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.INTEGRATIONS_CHAOS_MODE
    expect(isChaosAllowed()).toBe(false)
  })

  it('returns true only when non-prod + chaos mode enabled', () => {
    process.env.NODE_ENV = 'development'
    process.env.INTEGRATIONS_CHAOS_MODE = 'true'
    delete process.env.VERCEL_ENV
    delete process.env.AZURE_FUNCTIONS_ENVIRONMENT
    expect(isChaosAllowed()).toBe(true)
  })
})

describe('CHAOS_SCENARIOS', () => {
  it('defines all expected scenarios', () => {
    expect(CHAOS_SCENARIOS).toContain('provider_down')
    expect(CHAOS_SCENARIOS).toContain('slow')
    expect(CHAOS_SCENARIOS).toContain('rate_limited')
    expect(CHAOS_SCENARIOS).toContain('partial_fail')
  })
})

describe('ChaosSimulator', () => {
  let ports: ChaosPorts
  let chaos: ChaosSimulator

  beforeEach(() => {
    ports = makePorts()
    process.env.NODE_ENV = 'development'
    process.env.INTEGRATIONS_CHAOS_MODE = 'true'
    delete process.env.VERCEL_ENV
    delete process.env.AZURE_FUNCTIONS_ENVIRONMENT
    chaos = new ChaosSimulator(ports)
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('is not active when not enabled', () => {
    expect(chaos.isActive()).toBe(false)
    expect(chaos.getConfig()).toBeNull()
  })

  it('throws on enable in production', () => {
    process.env.NODE_ENV = 'production'
    expect(() => chaos.enable()).toThrow('CHAOS_GUARD')
  })

  it('enables and becomes active in non-prod', () => {
    chaos.enable({ scenario: 'provider_down' })
    expect(chaos.isActive()).toBe(true)
    expect(chaos.getConfig()?.scenario).toBe('provider_down')
  })

  it('disables correctly', () => {
    chaos.enable()
    chaos.disable()
    expect(chaos.isActive()).toBe(false)
    expect(chaos.getConfig()).toBeNull()
  })

  describe('intercept — provider_down', () => {
    it('intercepts and returns failure', () => {
      chaos.enable({ scenario: 'provider_down' })
      const result = chaos.intercept('org-1', 'resend')
      expect(result.intercepted).toBe(true)
      expect(result.result?.ok).toBe(false)
      expect(result.result?.error).toContain('CHAOS')
    })

    it('respects provider scope', () => {
      chaos.enable({ scenario: 'provider_down', targetProviders: ['slack'] })
      const result = chaos.intercept('org-1', 'resend')
      expect(result.intercepted).toBe(false)
    })

    it('respects org scope', () => {
      chaos.enable({ scenario: 'provider_down', targetOrgIds: ['org-2'] })
      const result = chaos.intercept('org-1', 'resend')
      expect(result.intercepted).toBe(false)
    })
  })

  describe('intercept — slow', () => {
    it('returns delayMs without intercepting the call', () => {
      chaos.enable({ scenario: 'slow', slowLatencyMs: 3000 })
      const result = chaos.intercept('org-1', 'resend')
      expect(result.intercepted).toBe(false)
      expect(result.delayMs).toBe(3000)
    })
  })

  describe('intercept — rate_limited', () => {
    it('intercepts with rate limit info', () => {
      chaos.enable({ scenario: 'rate_limited', rateLimitRetryAfterMs: 15_000 })
      const result = chaos.intercept('org-1', 'resend')
      expect(result.intercepted).toBe(true)
      expect(result.result?.ok).toBe(false)
      expect(result.result?.rateLimitInfo?.isRateLimited).toBe(true)
      expect(result.result?.rateLimitInfo?.retryAfterMs).toBe(15_000)
    })
  })

  describe('intercept — partial_fail', () => {
    it('fails when random is below threshold', () => {
      ports = makePorts({ random: () => 0.3 }) // 30% < 50% default = fail
      chaos = new ChaosSimulator(ports)
      chaos.enable({ scenario: 'partial_fail', partialFailPercent: 50 })
      const result = chaos.intercept('org-1', 'resend')
      expect(result.intercepted).toBe(true)
      expect(result.result?.ok).toBe(false)
    })

    it('passes when random is above threshold', () => {
      ports = makePorts({ random: () => 0.8 }) // 80% > 50% default = pass
      chaos = new ChaosSimulator(ports)
      chaos.enable({ scenario: 'partial_fail', partialFailPercent: 50 })
      const result = chaos.intercept('org-1', 'resend')
      expect(result.intercepted).toBe(false)
    })
  })
})
