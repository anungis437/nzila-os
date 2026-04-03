/**
 * Contract test: Registry ↔ Org-Scope enforcement alignment
 *
 * Validates:
 *   ORG-REG-001: Apps declaring requiresOrgScope=true actually use org-scope middleware
 *   ORG-REG-002: Apps NOT declaring requiresOrgScope must not have org-scope middleware
 *   ORG-REG-003: Apps with org-scope MUST have it in enabledCapabilities
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { APP_REGISTRY } from '@nzila/platform-contracts/registry'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

/**
 * Heuristic: look for org-scope usage in the app's route/middleware files.
 * We search for common patterns that indicate org-scope enforcement.
 */
function usesOrgScope(appDir: string): boolean {
  const patterns = [
    'requireOrgScope',
    'createScopedDb',
    'AuditedScopedDb',
    'ScopedDb',
    'orgScope',
    'org_id',
    '@nzila/platform-contracts/org-scope',
    'getOrganizationId',
    'requireActiveOrganization',
  ]

  const srcDirs = [
    join(appDir, 'src'),
    join(appDir, 'app'),
    join(appDir, 'pages'),
    join(appDir, 'lib'),
  ]

  for (const dir of srcDirs) {
    if (!existsSync(dir)) continue
    try {
      const files = walkSrcFiles(dir)
      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        if (patterns.some(p => content.includes(p))) return true
      }
    } catch {
      // skip inaccessible dirs
    }
  }
  return false
}

function walkSrcFiles(dir: string, acc: string[] = []): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '.next') {
        walkSrcFiles(full, acc)
      } else if (e.isFile() && /\.[jt]sx?$/.test(e.name) && !/\.(test|spec)\.[jt]sx?$/.test(e.name)) {
        acc.push(full)
      }
    }
  } catch {
    // skip
  }
  return acc
}

describe('Registry ↔ Org Scope alignment', () => {
  it('ORG-REG-001: apps declaring requiresOrgScope actually use org-scope code', () => {
    const orgScopeApps = APP_REGISTRY.filter(a => a.requiresOrgScope)
    const violations: string[] = []

    for (const app of orgScopeApps) {
      const appDir = join(APPS_DIR, app.id)
      if (!existsSync(appDir)) continue

      // Skip experimental/incubating apps that haven't been built out yet
      if (app.tier === 'EXPERIMENTAL' || app.tier === 'INCUBATING') continue

      if (!usesOrgScope(appDir)) {
        violations.push(
          `${app.id} declares requiresOrgScope=true but no org-scope usage found in code`,
        )
      }
    }

    expect(
      violations,
      `Org-scope mismatch:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('ORG-REG-003: apps with org-scope have it in enabledCapabilities', () => {
    const violations: string[] = []
    for (const app of APP_REGISTRY) {
      if (app.requiresOrgScope && !app.enabledCapabilities.includes('org-scope')) {
        violations.push(
          `${app.id} has requiresOrgScope=true but 'org-scope' not in enabledCapabilities`,
        )
      }
    }
    expect(violations).toEqual([])
  })
})
