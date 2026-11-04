import { describe, it, expect } from 'vitest'
import { checkVulnerabilityPolicy, validateSbomLicenses } from './supply-chain-policy'

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

  it('rejects malformed CVE arrays rather than dropping invalid identifiers', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-invalid-cves.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Malformed CVE identifiers'))).toBe(true)
  })

  it('rejects an empty GHSA identifier rather than ignoring it', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-invalid-ghsa.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Malformed GHSA identifier'))).toBe(true)
  })

  it('rejects malformed CVE identifiers even for low-severity findings', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-invalid-low-cve.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Malformed CVE identifiers'))).toBe(true)
  })

  it('rejects a nonempty but invalid CVE identifier at low severity', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-invalid-cve-syntax.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Malformed CVE identifiers'))).toBe(true)
  })

  it('rejects a nonempty but invalid GHSA identifier at low severity', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-invalid-ghsa-syntax.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Malformed GHSA identifier'))).toBe(true)
  })

  it('rejects missing affected package even for low-severity advisories', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-missing-low-package.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Missing package identity'))).toBe(true)
  })

  it('rejects conflicting package aliases even when one matches an active waiver', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-conflicting-package-alias.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Conflicting or malformed package identities'))).toBe(true)
  })

  it('rejects whitespace-spoofed package aliases before waiver matching', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-noncanonical-package-alias.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Conflicting or malformed package identities'))).toBe(true)
  })

  it('rejects a noncanonical advisory map key even if a secondary CVE matches an active waiver', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-noncanonical-map-key.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Malformed advisory map key'))).toBe(true)
  })

  it('rejects numeric advisory IDs rather than coercing them into waiver keys', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-numeric-advisory-id.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Advisory identity mismatch'))).toBe(true)
  })

  it('rejects control characters in package aliases before waiver matching', () => {
    const result = checkVulnerabilityPolicy(fixture('audit-control-package-alias.json'), atApproval)
    expect(result.passed).toBe(false)
    expect(result.errors.some((message) => message.includes('Conflicting or malformed package identities'))).toBe(true)
  })

  it('rejects an expired waiver without extending its validity', () => {
    const afterExpiry = new Date('2026-11-05T12:00:00Z')
    const result = checkVulnerabilityPolicy(fixture('audit-waived-package.json'), afterExpiry)
    expect(result.passed).toBe(false)
    expect(result.expiredWaivers).toContain('1240912')
    expect(result.unwaived).toBe(1)
  })
})


describe('security license policy: exact allowlist', () => {
  it('rejects forbidden licenses in nested CycloneDX components', () => {
    const violations = validateSbomLicenses(fixture('sbom-nested-forbidden-license.json'))
    expect(violations).toEqual([{ package: 'nested-forbidden', version: '2.0.0', license: 'GPL-3.0-only', status: 'forbidden' }])
  })

  it('rejects a forbidden SPDX expression even when another entry claims MIT', () => {
    const violations = validateSbomLicenses(fixture('sbom-expression-evidence.json'))
    expect(violations.map((item) => item.package)).toEqual(['forbidden-expression'])
    expect(violations[0]?.status).toBe('forbidden')
  })

  it('rejects an allowed license object paired with a contradictory SPDX expression', () => {
    expect(() => validateSbomLicenses(fixture('sbom-expression-conflict.json')))
      .toThrow('Ambiguous SPDX license evidence')
  })

  it('rejects an empty SBOM inventory instead of treating it as proof of compliance', () => {
    expect(() => validateSbomLicenses(fixture('sbom-empty-inventory.json')))
      .toThrow('SBOM contains no components to validate')
  })

  it('rejects conflicting SPDX license identifiers before accepting an allowed id', () => {
    expect(() => validateSbomLicenses(fixture('sbom-conflicting-license-identities.json')))
      .toThrow('Conflicting or malformed license identity')
  })

  it('rejects empty license arrays without rejecting an explicitly approved license', () => {
    const violations = validateSbomLicenses(fixture('sbom-empty-licenses.json'))
    expect(violations.map((violation) => violation.package)).toEqual(['unlicensed-empty', 'unlicensed-missing'])
    expect(violations.every((violation) => violation.license === 'UNKNOWN' && violation.status === 'unknown')).toBe(true)
  })

  it('fails closed when an arbitrary JSON document is supplied as an SBOM', () => {
    expect(() => validateSbomLicenses('package.json')).toThrow('SBOM missing components array')
  })

  it('rejects license substring spoofing and missing identifiers without rejecting reviewed dual licenses', () => {
    const violations = validateSbomLicenses('tooling/security/fixtures/sbom-license-substring-spoof.json')
    expect(violations.map((violation) => violation.package)).toEqual(['spoofed-license', 'missing-license'])
    expect(violations.every((violation) => violation.status === 'unknown')).toBe(true)
  })
})
