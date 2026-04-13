/**
 * Contract test: Control-Plane Authority (PHASE 3)
 *
 * CTRL-001: Every app must have a valid control-manifest.json
 * CTRL-002: control-manifest.json must have required fields
 * CTRL-003: App registry in platform-contracts must list all apps with manifests
 * CTRL-004: control-manifest riskLevel must match registry riskLevel
 * CTRL-005: All production apps must have a health endpoint
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
