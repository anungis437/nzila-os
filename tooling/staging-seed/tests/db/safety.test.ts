/**
 * Safety gate tests — env evaluation + org-id validation.
 *
 * These tests ensure the framework REFUSES to write to non-staging
 * databases by default, and that destructive ops cannot accidentally
 * touch real-tenant data.
 */
import { describe, expect, it } from 'vitest'

import {
  assertSafeStagingOrgId,
  evaluateSafety,
  isSafeStagingOrgId,
} from '../../src/db/safety'

function envWith(overrides: Record<string, string | undefined>): Record<string, string | undefined> {
  // Start from a clean slate so test cases are independent of host env.
  return overrides
}

describe('evaluateSafety', () => {
  it('refuses when STAGING_SEED_ENABLED is unset', () => {
    const decision = evaluateSafety(envWith({ DATABASE_URL: 'postgres://staging-host/db' }))
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toMatch(/STAGING_SEED_ENABLED/i)
  })

  it('refuses when STAGING_SEED_ENABLED is unrecognized', () => {
    const decision = evaluateSafety(
      envWith({ STAGING_SEED_ENABLED: 'maybe', DATABASE_URL: 'postgres://staging-host/db' }),
    )
    expect(decision.allowed).toBe(false)
  })

  it('refuses when DATABASE_URL is missing', () => {
    const decision = evaluateSafety(envWith({ STAGING_SEED_ENABLED: 'true' }))
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toMatch(/DATABASE_URL/i)
  })

  it('refuses when DATABASE_URL contains a denylist substring', () => {
    const decision = evaluateSafety(
      envWith({
        STAGING_SEED_ENABLED: 'true',
        DATABASE_URL: 'postgres://prod-db.example.com/app',
      }),
    )
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toMatch(/denylist|prod/i)
  })

  it('refuses when DATABASE_URL host matches no allowlist substring', () => {
    const decision = evaluateSafety(
      envWith({
        STAGING_SEED_ENABLED: 'true',
        DATABASE_URL: 'postgres://random-host.example.com/app',
      }),
    )
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toMatch(/allowlist|host/i)
  })

  it('allows localhost', () => {
    const decision = evaluateSafety(
      envWith({
        STAGING_SEED_ENABLED: 'true',
        DATABASE_URL: 'postgres://localhost:5433/nzila_automation',
      }),
    )
    expect(decision.allowed).toBe(true)
    expect(decision.databaseUrl).toBe('postgres://localhost:5433/nzila_automation')
    expect(decision.hostMatched).toBe('localhost')
  })

  it('allows hosts containing "staging"', () => {
    const decision = evaluateSafety(
      envWith({
        STAGING_SEED_ENABLED: 'true',
        DATABASE_URL: 'postgres://nzila-staging-db.example.com:5432/nzila',
      }),
    )
    expect(decision.allowed).toBe(true)
    expect(decision.hostMatched).toBe('staging')
  })

  it('honors a custom URL_ALLOWLIST_ENV value', () => {
    const decision = evaluateSafety(
      envWith({
        STAGING_SEED_ENABLED: 'true',
        DATABASE_URL: 'postgres://qa-db.example.com/app',
        STAGING_SEED_URL_ALLOWLIST: 'qa,staging',
      }),
    )
    expect(decision.allowed).toBe(true)
    expect(decision.hostMatched).toBe('qa')
  })
})

describe('isSafeStagingOrgId / assertSafeStagingOrgId', () => {
  it.each([
    'org-ue-staging-local-9999',
    'org-flow-staging-merchant-9999',
    'org-weekone-staging-founder-9999',
    'org-zonga-staging-label-9999',
    'org-staging-anything',
  ])('accepts staging org id "%s"', (id) => {
    expect(isSafeStagingOrgId(id)).toBe(true)
    expect(() => assertSafeStagingOrgId(id)).not.toThrow()
  })

  it.each([
    'org-real-tenant-1',
    'org-acme-corp',
    'tenant-staging',
    'staging-org',
    '',
    'STAGING_LOCAL',
  ])('rejects non-staging id "%s"', (id) => {
    expect(isSafeStagingOrgId(id)).toBe(false)
    expect(() => assertSafeStagingOrgId(id)).toThrow()
  })
})
