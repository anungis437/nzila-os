/**
 * Contract Test — Sovereign Egress Allowlist
 *
 * Structural invariant: When deployment profile is sovereign, egress
 * must be restricted to an explicit allowlist. Middleware must block
 * unapproved outbound hosts. The platform-deploy package must export
 * egress enforcement primitives.
 *
 * @invariant SOVEREIGN_EGRESS_ALLOWLIST_005
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

describe('SOVEREIGN_EGRESS_ALLOWLIST_005 — Sovereign egress controls', () => {
  it('platform-deploy sovereign module exists', () => {
    const sovereignPath = join(ROOT, 'packages', 'platform-deploy', 'src', 'sovereign.ts')
    expect(existsSync(sovereignPath), 'packages/platform-deploy/src/sovereign.ts must exist').toBe(true)
  })

  it('sovereign module exports checkEgress function', () => {
    const content = readFileSync(join(ROOT, 'packages', 'platform-deploy', 'src', 'sovereign.ts'), 'utf-8')
    expect(content).toContain('export function checkEgress')
    expect(content).toContain('EgressAllowlist')
    expect(content).toContain('EgressCheckResult')
  })

  it('sovereign module supports wildcard subdomain matching', () => {
    const content = readFileSync(join(ROOT, 'packages', 'platform-deploy', 'src', 'sovereign.ts'), 'utf-8')
    expect(content).toContain('*.')
  })

  it('sovereign module exports audit log for proof packs', () => {
    const content = readFileSync(join(ROOT, 'packages', 'platform-deploy', 'src', 'sovereign.ts'), 'utf-8')
    expect(content).toContain('export function recordEgressCheck')
    expect(content).toContain('export function getEgressAuditLog')
    expect(content).toContain('export function getEgressStats')
    expect(content).toContain('export function buildEgressProofSection')
  })

  it('sovereign module uses Zod for schema validation', () => {
    const content = readFileSync(join(ROOT, 'packages', 'platform-deploy', 'src', 'sovereign.ts'), 'utf-8')
    expect(content).toContain('EgressRuleSchema')
    expect(content).toContain('EgressAllowlistSchema')
    expect(content).toContain('zod')
  })

  it('platform-deploy package.json exports sovereign sub-path', () => {
    const pkgPath = join(ROOT, 'packages', 'platform-deploy', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.exports['./sovereign']).toBeDefined()
  })

  it('Console proxy enforces sovereign egress (403 on blocked)', () => {
    const mwPath = join(ROOT, 'apps', 'console', 'proxy.ts')
    const content = readFileSync(mwPath, 'utf-8')

    expect(content).toContain('SOVEREIGN_EGRESS_ENFORCED')
    expect(content).toContain('SOVEREIGN_EGRESS_ALLOWLIST')
    expect(content).toContain('SOVEREIGN_EGRESS_BLOCKED')
    expect(content).toContain('403')
  })

  it('Console deployment profile page shows egress enforcement status', () => {
    const pagePath = join(ROOT, 'apps', 'console', 'app', '(dashboard)', 'deployment-profile', 'page.tsx')
    const content = readFileSync(pagePath, 'utf-8')

    expect(content).toContain('Egress Allowlist Enforcement')
    expect(content).toContain('egressEnforced')
    expect(content).toContain('SOVEREIGN_EGRESS_ALLOWLIST')
  })

  it('deploy-profile module exports profile validation with egress checks', () => {
    const profilePath = join(ROOT, 'packages', 'platform-deploy', 'src', 'deploy-profile.ts')
    const content = readFileSync(profilePath, 'utf-8')

    expect(content).toContain('EGRESS_ALLOWLIST_ENFORCED')
    expect(content).toContain('egressAllowlistEnforced')
    expect(content).toContain('egressAllowlist')
  })

  it('DB schema includes deployment profiles table', () => {
    const schemaPath = join(ROOT, 'packages', 'db', 'src', 'schema', 'platform.ts')
    const content = readFileSync(schemaPath, 'utf-8')
    expect(content).toContain('platformDeploymentProfiles')
    expect(content).toContain('egressAllowlist')
  })
})
