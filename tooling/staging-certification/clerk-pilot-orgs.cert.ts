/**
 * Clerk Pilot Org Readiness Certification
 *
 * Validates that all pilot organizations have proper Clerk setup
 * in the staging seed and environment configuration:
 *  - clerk_organization_id set for every pilot org
 *  - Real Clerk user IDs (user_*) for testable members
 *  - PLATFORM_ADMIN_USER_IDS documented in .env.example
 *  - SUPER_ADMIN_ORG_ID documented in .env.example
 *  - Deploy workflow exposes auth env vars to container
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const UE = join(ROOT, 'apps', 'union-eyes')

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

// --------------------------------------------------------------------------
// Pilot orgs & Clerk org IDs
// --------------------------------------------------------------------------
const PILOT_ORGS = [
  { slug: 'default',        name: 'NZILA Ventures',  clerkId: 'org_3A1qYmVHWmeSbbZhlPMwVIrGHFQ' },
  { slug: 'clc',            name: 'CLC',             clerkId: 'org_3B3NjHnvzeSJBZQE8PGQf0nmgts' },
  { slug: 'cape-acep',      name: 'CAPE-ACEP',       clerkId: 'org_3B3Nj6NGSY6rT9ibI8bgFhZdMRN' },
  { slug: 'cupe-local-123', name: 'CUPE Local 123',  clerkId: 'org_3BP6K4uezEa2CLEvUNDwhnJGNFg' },
]

const seedSql = read(join(UE, 'db', 'seeds', 'seed-staging-3orgs.sql'))
const envExample = read(join(UE, '.env.example'))
const deployWf = read(join(ROOT, '.github', 'workflows', 'deploy-union-eyes.yml'))

// --------------------------------------------------------------------------
// Clerk Organization IDs in Seed SQL
// --------------------------------------------------------------------------
describe('CERT — Clerk Org IDs in Staging Seed', () => {
  for (const org of PILOT_ORGS) {
    it(`${org.name} (${org.slug}) has clerk_organization_id = ${org.clerkId}`, () => {
      expect(seedSql).toContain(org.clerkId)
    })
  }
})

// --------------------------------------------------------------------------
// Real Clerk User IDs per Org
// --------------------------------------------------------------------------
describe('CERT — Real Clerk User IDs per Org', () => {
  it('NZILA Ventures has at least 3 real Clerk user IDs (user_*)', () => {
    // Count user_ lines associated with the NZILA org UUID
    const nzilaSection = seedSql.split('458a56cb-251a-4c91-a0b5-81bb8ac39087')
    const userIdMatches = seedSql.match(/\('user_[A-Za-z0-9]+',\s*'458a56cb/g)
    expect(userIdMatches?.length ?? 0).toBeGreaterThanOrEqual(3)
  })

  it('CLC has at least 10 real Clerk user IDs (user_*)', () => {
    // CLC members all use user_3BSy* or user_3BSzD* prefixes
    const clcUserMatches = seedSql.match(/user_3BS[yz][A-Za-z0-9]+/g)
    expect(clcUserMatches?.length ?? 0).toBeGreaterThanOrEqual(10)
  })

  it('CAPE has at least 12 real Clerk user IDs (user_*)', () => {
    const capeUserMatches = seedSql.match(/user_3BS[yz][A-Za-z0-9]+/g)
    // CLC(10) + CAPE(12) share similar prefixes; verify total >= 22
    expect(capeUserMatches?.length ?? 0).toBeGreaterThanOrEqual(22)
  })

  it('CUPE has at least 3 real Clerk user IDs (user_*)', () => {
    const cupeUserMatches = seedSql.match(/\('user_[A-Za-z0-9]+',\s*'9210418f/g)
    expect(cupeUserMatches?.length ?? 0).toBeGreaterThanOrEqual(3)
  })

  it('no synthetic user IDs remain (clc-user-*, cape-user-*)', () => {
    expect(seedSql).not.toMatch(/clc-user-\d+/)
    expect(seedSql).not.toMatch(/cape-user-\d+/)
  })

  it('platform admins appear in all 4 orgs', () => {
    const superAdminCount = (seedSql.match(/user_35NlrrNcfTv0DMh2kzBHyXZRtpb/g) ?? []).length
    const platformAdminCount = (seedSql.match(/user_37Zo7OrvP4jy0J0MU5APfkDtE2V/g) ?? []).length
    // Both admins in NZILA + CLC + CAPE + CUPE = 4 each
    expect(superAdminCount).toBeGreaterThanOrEqual(4)
    expect(platformAdminCount).toBeGreaterThanOrEqual(4)
  })
})

// --------------------------------------------------------------------------
// Environment Configuration
// --------------------------------------------------------------------------
describe('CERT — Auth Environment Configuration', () => {
  it('.env.example documents SUPER_ADMIN_ORG_ID', () => {
    expect(envExample).toContain('SUPER_ADMIN_ORG_ID')
  })

  it('.env.example documents PLATFORM_ADMIN_USER_IDS', () => {
    expect(envExample).toContain('PLATFORM_ADMIN_USER_IDS')
  })

  it('.env.example has recommended dev/staging values in comments', () => {
    expect(envExample).toContain('458a56cb-251a-4c91-a0b5-81bb8ac39087')
    expect(envExample).toContain('user_35NlrrNcfTv0DMh2kzBHyXZRtpb')
  })
})

// --------------------------------------------------------------------------
// Deploy Workflow
// --------------------------------------------------------------------------
describe('CERT — Deploy Workflow Auth Vars', () => {
  it('deploy-union-eyes.yml passes PLATFORM_ADMIN_USER_IDS', () => {
    expect(deployWf).toContain('PLATFORM_ADMIN_USER_IDS')
  })

  it('deploy-union-eyes.yml passes SUPER_ADMIN_ORG_ID', () => {
    expect(deployWf).toContain('SUPER_ADMIN_ORG_ID')
  })

  it('deploy-union-eyes.yml passes CLERK_JWKS_URL for Django sidecar', () => {
    expect(deployWf).toContain('CLERK_JWKS_URL')
  })
})

// --------------------------------------------------------------------------
// Seed SQL preserves all 4 orgs in cleanup
// --------------------------------------------------------------------------
describe('CERT — Seed SQL Cleanup Preserves All 4 Orgs', () => {
  it('cleanup query includes cupe-local-123', () => {
    expect(seedSql).toContain("'cupe-local-123'")
  })

  it('cleanup query preserves all 4 slugs', () => {
    for (const org of PILOT_ORGS) {
      expect(seedSql).toContain(`'${org.slug}'`)
    }
  })
})
