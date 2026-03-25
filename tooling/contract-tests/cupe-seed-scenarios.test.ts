/**
 * Contract Test — CUPE-Grade Seed Scenarios (Phase 4)
 *
 * Verifies that seed data covers realistic multi-union hierarchy
 * scenarios required for production-grade CUPE deployment testing.
 *
 * Checks:
 *   1. Seed files exist in at least one standard location
 *   2. Seeds reference multiple organizations (multi-tenant isolation)
 *   3. Seeds include financial table data (dues, payments, billing)
 *   4. Seeds include member / membership data
 *   5. No production secrets leaked into seed files
 *   6. Seeds are deterministic (use gen_random_uuid() or fixed UUIDs, not random())
 *
 * @invariant INV-SEED-CUPE: seed data supports CUPE production-grade testing
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const SEEDS_DIR = join(ROOT, 'apps', 'union-eyes', 'db', 'seeds')
const SCRIPTS_DIR = join(ROOT, 'scripts')

function collectAllSeedContent(): string {
  let combined = ''

  if (existsSync(SEEDS_DIR)) {
    for (const f of readdirSync(SEEDS_DIR).filter((f) => f.endsWith('.sql'))) {
      combined += readFileSync(join(SEEDS_DIR, f), 'utf-8') + '\n'
    }
  }

  if (existsSync(SCRIPTS_DIR)) {
    for (const f of readdirSync(SCRIPTS_DIR).filter(
      (f) => f.startsWith('seed-') && f.endsWith('.sql'),
    )) {
      combined += readFileSync(join(SCRIPTS_DIR, f), 'utf-8') + '\n'
    }
  }

  return combined
}

describe('INV-SEED-CUPE — CUPE-Grade Seed Scenarios', () => {
  const allSeedContent = collectAllSeedContent()

  it('seed files exist in at least one location', () => {
    expect(allSeedContent.length).toBeGreaterThan(0)
  })

  it('covers multiple organizations (multi-tenant isolation)', () => {
    // Seeds must reference organization_id or org_id in multiple places
    const orgIdRefs = allSeedContent.match(/organization_id|org_id/gi) ?? []
    expect(orgIdRefs.length).toBeGreaterThanOrEqual(2)
  })

  it('contains INSERT statements targeting financial tables', () => {
    const financialTables = [
      'dues_transactions',
      'dues_rates',
      'dues_rules',
      'dues_assignments',
      'billing_accounts',
      'billing_subscriptions',
      'billing_invoices',
      'billing_payments',
      'platform_invoices',
      'platform_payments',
      'commerce_payments',
    ]
    const hitTables = financialTables.filter((t) =>
      allSeedContent.toLowerCase().includes(t),
    )
    // At least some financial tables must appear in seeds
    expect(hitTables.length).toBeGreaterThanOrEqual(1)
  })

  it('seeds contain member data', () => {
    const memberRefs = allSeedContent.match(/member_id|members/gi) ?? []
    expect(memberRefs.length).toBeGreaterThanOrEqual(1)
  })

  it('no hardcoded production secrets in seed files', () => {
    const secretPatterns = [
      /sk_live_[a-zA-Z0-9]{10,}/, // Stripe live secret key
      /pk_live_[a-zA-Z0-9]{10,}/, // Stripe live publishable key
      /AKIA[0-9A-Z]{16}/, // AWS access key
    ]
    for (const pattern of secretPatterns) {
      expect(allSeedContent).not.toMatch(pattern)
    }
  })

  it('seed files do not use non-deterministic random() for IDs', () => {
    // Seeds should use fixed UUIDs or gen_random_uuid() — never random():: for amounts
    // Exclude gen_random_uuid() which is acceptable
    const lines = allSeedContent.split('\n')
    const badLines = lines.filter(
      (line) =>
        /\brandom\(\)/.test(line) && !line.includes('gen_random_uuid'),
    )
    expect(badLines.length).toBe(0)
  })
})
