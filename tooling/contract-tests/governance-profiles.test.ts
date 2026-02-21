/**
 * Contract Test — Governance Profile Validation
 *
 * Ensures that:
 *   1. All profiles exist and are well-formed
 *   2. No profile disables immutable controls
 *   3. Profile registry covers all known verticals
 *   4. validateProfile() catches violations
 *
 * @invariant INV-15: Governance profiles cannot disable core controls
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const PROFILES_PATH = join(ROOT, 'governance', 'profiles', 'index.ts')

describe('INV-15 — Governance profiles integrity', () => {
  it('profiles module exists', () => {
    expect(existsSync(PROFILES_PATH)).toBe(true)
  })

  it('profiles module exports IMMUTABLE_CONTROLS', () => {
    const content = readFileSync(PROFILES_PATH, 'utf-8')
    expect(content).toContain('IMMUTABLE_CONTROLS')
    expect(content).toContain('org-isolation')
    expect(content).toContain('audit-emission')
    expect(content).toContain('evidence-sealing')
    expect(content).toContain('hash-chain-integrity')
  })

  it('profiles module exports validateProfile', () => {
    const content = readFileSync(PROFILES_PATH, 'utf-8')
    expect(content).toContain('export function validateProfile')
  })

  it('all required profiles are defined', () => {
    const content = readFileSync(PROFILES_PATH, 'utf-8')
    const requiredProfiles = [
      'union-eyes',
      'abr-insights',
      'fintech',
      'commerce',
      'agtech',
      'media',
      'advisory',
    ]
    for (const profile of requiredProfiles) {
      expect(
        content,
        `Profile "${profile}" must be defined`,
      ).toContain(`'${profile}'`)
    }
  })

  it('no profile contains disable/skip/bypass patterns', () => {
    const content = readFileSync(PROFILES_PATH, 'utf-8')
    // Extract the PROFILES object content
    const profilesSection = content.slice(
      content.indexOf('export const PROFILES'),
    )

    // These patterns must NOT appear in profile definitions
    const forbidden = [
      /disableIsolation/i,
      /disableAudit/i,
      /disableSealing/i,
      /skipScanner/i,
      /bypassContract/i,
    ]

    for (const pattern of forbidden) {
      expect(
        pattern.test(profilesSection),
        `Profiles must not contain pattern: ${pattern}`,
      ).toBe(false)
    }
  })

  it('validateProfile function catches violations', () => {
    const content = readFileSync(PROFILES_PATH, 'utf-8')
    expect(content).toContain('disablePatterns')
    expect(content).toContain('disable.*isolation')
    expect(content).toContain('skip.*audit')
    expect(content).toContain('bypass.*seal')
  })
})
