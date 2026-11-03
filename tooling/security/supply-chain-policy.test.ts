import { describe, it, expect } from 'vitest'
import { checkVulnerabilityPolicy } from './supply-chain-policy'

const atApproval = new Date('2026-10-10T12:00:00Z')
const fixture = (name: string) => `tooling/security/fixtures/${name}`

describe('security audit policy: fail closed', () => {
  it('refuses an arbitrary JSON file in place of a valid audit', () => {
    const result = checkVulnerabilityPolicy('package.json', atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Invalid or unreadable audit report'))).toBe(true)
  })

  it('rejects a forged zero-vulnerability report without collector provenance', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-forged-empty.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('collector provenance'))).toBe(true)
  })

  it('accepts a valid, completed, zero-vulnerability inventory', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-clean.json'), atApproval)
    expect(result.highOrCritical).toBe(0)
    expect(result.errors).toEqual([])
    expect(result.passed).toBe(true)
  })

  it('does not permit a waiver ID to authorize a different package', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-wrong-package.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.unwaived).toBe(1)
  })

  it('preserves a verified same-ID same-package waiver within its approval window', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-waived-package.json'), atApproval)
    expect(result.waived).toBe(1)
    expect(result.unwaived).toBe(0)
    expect(result.passed).toBe(true)
  })

  it('rejects a mismatched collector vulnerability summary', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-count-mismatch.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('disagrees'))).toBe(true)
  })

  it('rejects a missing low-severity summary count', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-missing-low-count.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Malformed or missing vulnerability summary: low'))).toBe(true)
  })

  it('does not let a HIGH waiver authorize a CRITICAL advisory of the same ID and package', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-waiver-severity-mismatch.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.waived).toBe(0)
    expect(result.unwaived).toBe(1)
  })

  it('rejects an advisory whose declared ID differs from its map key', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-identity-mismatch.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Advisory identity mismatch'))).toBe(true)
  })

  it('rejects a forged alternate vulnerabilities collection even when advisories is empty', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-dual-collections.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('alternate vulnerabilities collection'))).toBe(true)
  })

  it('rejects an expired waiver without extending its validity', () => {
    const afterExpiry = new Date('2026-11-05T12:00:00Z')
    const result = checkVulnerabilityPolicy(fixture('audit-waived-package.json'), afterExpiry)
    expect(result.passed).toBe(false)
    expect(result.expiredWaivers).toContain('1240912')
    expect(result.unwaived).toBe(1)
  })
})
