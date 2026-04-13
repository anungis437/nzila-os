import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkEgress,
  recordEgressCheck,
  getEgressAuditLog,
  getEgressStats,
  buildEgressProofSection,
  type EgressAllowlist,
} from './sovereign.js'

const ENFORCED_ALLOWLIST: EgressAllowlist = {
  enforced: true,
  rules: [
    { host: 'api.stripe.com', reason: 'Payment processing' },
    { host: '*.slack.com', reason: 'ChatOps notifications' },
    { host: 'hooks.zapier.com', port: 443, reason: 'Webhook relay' },
  ],
}

const UNENFORCED: EgressAllowlist = { enforced: false, rules: [] }

describe('checkEgress', () => {
  it('allows everything when not enforced', () => {
    const result = checkEgress('evil.example.com', 443, UNENFORCED)
    expect(result.allowed).toBe(true)
    expect(result.matchedRule).toBeNull()
  })

  it('allows exact host match', () => {
    const result = checkEgress('api.stripe.com', 443, ENFORCED_ALLOWLIST)
    expect(result.allowed).toBe(true)
    expect(result.matchedRule?.host).toBe('api.stripe.com')
  })

  it('allows wildcard subdomain match', () => {
    const result = checkEgress('hooks.slack.com', 443, ENFORCED_ALLOWLIST)
    expect(result.allowed).toBe(true)
  })

  it('allows wildcard root-domain match', () => {
    const result = checkEgress('slack.com', 443, ENFORCED_ALLOWLIST)
    expect(result.allowed).toBe(true)
  })

  it('blocks unlisted host', () => {
    const result = checkEgress('evil.example.com', 443, ENFORCED_ALLOWLIST)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not in the egress allowlist')
  })

  it('blocks when port does not match rule restriction', () => {
    const result = checkEgress('hooks.zapier.com', 8080, ENFORCED_ALLOWLIST)
    expect(result.allowed).toBe(false)
  })

  it('allows when port matches rule restriction', () => {
    const result = checkEgress('hooks.zapier.com', 443, ENFORCED_ALLOWLIST)
    expect(result.allowed).toBe(true)
  })

  it('is case-insensitive for hosts', () => {
    const result = checkEgress('API.STRIPE.COM', 443, ENFORCED_ALLOWLIST)
    expect(result.allowed).toBe(true)
  })
})

describe('egress audit log', () => {
  beforeEach(() => {
    // Clear the audit log by draining it
    const log = getEgressAuditLog()
    ;(log as EgressAuditEntry[]).length = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type EgressAuditEntry = any
  })

  it('records egress checks', () => {
    const result = checkEgress('api.stripe.com', 443, ENFORCED_ALLOWLIST)
    recordEgressCheck(result, 'corr-123')
    const log = getEgressAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(1)
    const last = log[log.length - 1]
    expect(last?.host).toBe('api.stripe.com')
    expect(last?.correlationId).toBe('corr-123')
  })

  it('getEgressStats returns correct counts', () => {
    const allowed = checkEgress('api.stripe.com', 443, ENFORCED_ALLOWLIST)
    const blocked = checkEgress('evil.example.com', 443, ENFORCED_ALLOWLIST)
    recordEgressCheck(allowed)
    recordEgressCheck(blocked)
    const stats = getEgressStats()
    expect(stats.allowed).toBeGreaterThanOrEqual(1)
    expect(stats.blocked).toBeGreaterThanOrEqual(1)
  })

  it('trims the log when max size is exceeded', () => {
    const allowed = checkEgress('api.stripe.com', 443, ENFORCED_ALLOWLIST)

    for (let i = 0; i < 2100; i++) {
      recordEgressCheck(allowed, `corr-${i}`)
    }

    const log = getEgressAuditLog()
    expect(log.length).toBeLessThanOrEqual(2000)
  })
})

describe('buildEgressProofSection', () => {
  it('returns correct proof section shape', () => {
    const proof = buildEgressProofSection(ENFORCED_ALLOWLIST)
    expect(proof.section).toBe('sovereign_egress')
    expect(proof.enforced).toBe(true)
    expect(proof.allowlistSize).toBe(3)
    expect(typeof proof.stats.total).toBe('number')
  })
})
