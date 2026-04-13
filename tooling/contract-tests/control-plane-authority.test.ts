/**
 * Contract test: Control-Plane Authority (PHASE 3)
 *
 * CTRL-001: Every app must have a valid control-manifest.json
 * CTRL-002: control-manifest.json must have required fields
 * CTRL-003: App registry in platform-contracts must list every filesystem app
 * CTRL-004: control-manifest.json 'app' field matches filesystem directory name
 * CTRL-005: All production apps must have a health endpoint
 * CTRL-006: Control plane has unified system state
 * CTRL-007: Revenue apps depend on control-plane-compatible packages
 * CTRL-008: Control plane exposes system-state API route
 * CTRL-009: Apps that emit financial records (registry) must depend on platform-revenue
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

function readJSON(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function listApps(): string[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name)
}

// ── CTRL-001: Every app has control-manifest.json ───────────────────────────

describe('CTRL-001: All apps have control-manifest.json', () => {
  const apps = listApps()

  for (const app of apps) {
    it(`${app} has control-manifest.json`, () => {
      const manifestPath = join(APPS_DIR, app, 'control-manifest.json')
      expect(existsSync(manifestPath), `${app}/control-manifest.json must exist`).toBe(true)
    })
  }
})

// ── CTRL-002: Manifest has required fields ──────────────────────────────────

describe('CTRL-002: control-manifest.json has required fields', () => {
  const REQUIRED_FIELDS = ['app', 'version', 'riskLevel', 'controls']
  const REQUIRED_CONTROLS = [
    'enforcement',
    'governance',
    'audit',
    'observability',
    'security',
    'contracts',
  ]

  const apps = listApps()

  for (const app of apps) {
    const manifestPath = join(APPS_DIR, app, 'control-manifest.json')

    it(`${app} manifest has all required top-level fields`, () => {
      if (!existsSync(manifestPath)) return
      const manifest = readJSON(manifestPath)
      expect(manifest).not.toBeNull()

      for (const field of REQUIRED_FIELDS) {
        expect(manifest, `Missing field: ${field}`).toHaveProperty(field)
      }
    })

    it(`${app} manifest has all required control flags`, () => {
      if (!existsSync(manifestPath)) return
      const manifest = readJSON(manifestPath)
      if (!manifest?.controls) return

      const controls = manifest.controls as Record<string, unknown>
      for (const ctrl of REQUIRED_CONTROLS) {
        expect(controls, `Missing control flag: ${ctrl}`).toHaveProperty(ctrl)
      }
    })

    it(`${app} manifest riskLevel is valid`, () => {
      if (!existsSync(manifestPath)) return
      const manifest = readJSON(manifestPath)
      if (!manifest) return
      expect(['critical', 'high', 'medium', 'low', 'none']).toContain(manifest.riskLevel)
    })
  }
})

// ── CTRL-005: All production apps have health endpoints ─────────────────────

describe('CTRL-005: Production apps have health endpoints', () => {
  // These apps are production-deployed and MUST have health routes
  const PRODUCTION_APPS = [
    'web',
    'console',
    'union-eyes',
    'flow',
    'zonga',
    'partners',
    'abr',
    'cfo',
    'nacp-exams',
    'agrimo',
    'cora',
    'trade',
    'control-plane',
    'platform-admin',
    'mobility',
  ]

  for (const app of PRODUCTION_APPS) {
    it(`${app} has app/api/health/route.ts`, () => {
      const healthPath = join(APPS_DIR, app, 'app', 'api', 'health', 'route.ts')
      expect(
        existsSync(healthPath),
        `${app}/app/api/health/route.ts must exist for production readiness`,
      ).toBe(true)
    })
  }

  it('health endpoints export GET handler', () => {
    const violations: string[] = []
    for (const app of PRODUCTION_APPS) {
      const healthPath = join(APPS_DIR, app, 'app', 'api', 'health', 'route.ts')
      if (!existsSync(healthPath)) continue
      const src = readFileSync(healthPath, 'utf-8')
      if (!src.includes('export async function GET') && !src.includes('export function GET')) {
        violations.push(app)
      }
    }
    expect(violations, `Apps missing GET export: ${violations.join(', ')}`).toEqual([])
  })
})

// ── CTRL-006: Control plane has unified system state ────────────────────────

describe('CTRL-006: Control plane has unified system state', () => {
  it('system-state.ts exists with getSystemState export', () => {
    const statePath = join(APPS_DIR, 'control-plane', 'services', 'system-state.ts')
    expect(existsSync(statePath), 'services/system-state.ts must exist').toBe(true)
    const content = readFileSync(statePath, 'utf-8')
    expect(content).toContain('getSystemState')
    expect(content).toContain('SystemState')
    expect(content).toContain('DomainHealth')
  })

  it('revenue-aggregator.ts exists with getRevenueOverview export', () => {
    const aggPath = join(APPS_DIR, 'control-plane', 'services', 'revenue-aggregator.ts')
    expect(existsSync(aggPath), 'services/revenue-aggregator.ts must exist').toBe(true)
    const content = readFileSync(aggPath, 'utf-8')
    expect(content).toContain('getRevenueOverview')
    expect(content).toContain('@nzila/platform-revenue')
  })
})

// ── CTRL-007: Revenue apps report to control plane ──────────────────────────

describe('CTRL-007: Revenue apps depend on control-plane-compatible packages', () => {
  const REVENUE_APPS = ['zonga', 'cfo', 'flow', 'partners', 'trade']

  for (const app of REVENUE_APPS) {
    it(`${app} depends on @nzila/platform-revenue (control-plane aggregatable)`, () => {
      const pkgPath = join(APPS_DIR, app, 'package.json')
      if (!existsSync(pkgPath)) return
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      expect(
        deps['@nzila/platform-revenue'],
        `${app} must depend on @nzila/platform-revenue so revenue is aggregatable by control-plane`,
      ).toBeDefined()
    })
  }
})

// ── CTRL-008: Control plane exposes system-state API route ──────────────────

describe('CTRL-008: Control plane has system-state API route', () => {
  it('system-state route.ts exists', () => {
    const routePath = join(
      APPS_DIR,
      'control-plane',
      'app',
      'api',
      'control-plane',
      'system-state',
      'route.ts',
    )
    expect(
      existsSync(routePath),
      'control-plane must expose /api/control-plane/system-state endpoint',
    ).toBe(true)
  })

  it('system-state route imports getSystemState', () => {
    const routePath = join(
      APPS_DIR,
      'control-plane',
      'app',
      'api',
      'control-plane',
      'system-state',
      'route.ts',
    )
    if (!existsSync(routePath)) return
    const content = readFileSync(routePath, 'utf-8')
    expect(content).toContain('getSystemState')
  })

  it('system-state route imports getRevenueOverview', () => {
    const routePath = join(
      APPS_DIR,
      'control-plane',
      'app',
      'api',
      'control-plane',
      'system-state',
      'route.ts',
    )
    if (!existsSync(routePath)) return
    const content = readFileSync(routePath, 'utf-8')
    expect(content).toContain('getRevenueOverview')
  })

  it('system-state route exports GET handler', () => {
    const routePath = join(
      APPS_DIR,
      'control-plane',
      'app',
      'api',
      'control-plane',
      'system-state',
      'route.ts',
    )
    if (!existsSync(routePath)) return
    const content = readFileSync(routePath, 'utf-8')
    expect(content).toMatch(/export\s+(async\s+)?function\s+GET/)
  })
})

// ── CTRL-003: App registry lists every filesystem app ───────────────────────

describe('CTRL-003: Platform-contracts registry covers all apps', () => {
  const registryPath = join(ROOT, 'packages', 'platform-contracts', 'src', 'registry.ts')

  it('registry.ts exists', () => {
    expect(existsSync(registryPath), 'packages/platform-contracts/src/registry.ts must exist').toBe(true)
  })

  it('every filesystem app has a registry entry', () => {
    if (!existsSync(registryPath)) return
    const registryContent = readFileSync(registryPath, 'utf-8')
    const apps = listApps()
    const missing: string[] = []

    for (const app of apps) {
      // Check that the registry has an entry with id matching the app dir name
      const pattern = new RegExp(`id:\\s*['"]${app}['"]`)
      if (!pattern.test(registryContent)) {
        missing.push(app)
      }
    }

    expect(
      missing,
      `Apps missing from platform-contracts registry: ${missing.join(', ')}`,
    ).toHaveLength(0)
  })
})

// ── CTRL-004: control-manifest.json 'app' matches directory name ────────────

describe('CTRL-004: control-manifest app field matches directory', () => {
  const apps = listApps()

  for (const app of apps) {
    it(`${app}/control-manifest.json 'app' field matches "${app}"`, () => {
      const manifestPath = join(APPS_DIR, app, 'control-manifest.json')
      if (!existsSync(manifestPath)) return
      const manifest = readJSON(manifestPath)
      if (!manifest) return
      expect(
        manifest.app,
        `${app}/control-manifest.json: 'app' is "${manifest.app}" but directory is "${app}"`,
      ).toBe(app)
    })
  }
})

// ── CTRL-009: Financial-record emitters must depend on platform-revenue ─────

describe('CTRL-009: Financial-record emitters depend on platform-revenue', () => {
  const registryPath = join(ROOT, 'packages', 'platform-contracts', 'src', 'registry.ts')

  /**
   * Apps that emit financial records via their own governed subsystem
   * (e.g., union-eyes has a Django financial-service with its own audit trail).
   * These don't route through @nzila/platform-revenue but are still governed.
   */
  const SELF_GOVERNED_FINANCIAL_APPS = new Set(['union-eyes'])

  it('apps with emitsFinancialRecords: true depend on @nzila/platform-revenue', () => {
    if (!existsSync(registryPath)) return

    const registryContent = readFileSync(registryPath, 'utf-8')
    const lines = registryContent.split('\n')

    // Line-by-line state machine: track the most recent id, flag financial apps
    const financialApps: string[] = []
    let currentId = ''
    for (const line of lines) {
      const idMatch = line.match(/id:\s*['"]([^'"]+)['"]/)
      if (idMatch) currentId = idMatch[1]
      if (line.includes('emitsFinancialRecords: true') && currentId) {
        financialApps.push(currentId)
      }
    }

    expect(financialApps.length, 'Should find at least one app with emitsFinancialRecords').toBeGreaterThan(0)

    const violations: string[] = []
    for (const appId of financialApps) {
      if (SELF_GOVERNED_FINANCIAL_APPS.has(appId)) continue
      const pkgPath = join(APPS_DIR, appId, 'package.json')
      if (!existsSync(pkgPath)) {
        violations.push(`${appId}: package.json not found`)
        continue
      }
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (!deps['@nzila/platform-revenue']) {
        violations.push(`${appId}: emitsFinancialRecords but missing @nzila/platform-revenue dep`)
      }
    }

    expect(
      violations,
      `Financial apps without platform-revenue: ${violations.join('; ')}`,
    ).toHaveLength(0)
  })
})
