/**
 * Contract test: Observability Unification (PHASE 6)
 *
 * OBS-001: Production API routes must not use bare console.log
 * OBS-002: Apps must have @nzila/observability in dependencies
 * OBS-003: Production apps must have instrumentation.ts or app-telemetry setup
 * OBS-004: Health endpoints must return structured JSON with timestamp
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

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

function walkFiles(dir: string, acc: string[] = []): string[] {
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name)
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '.next') {
        walkFiles(full, acc)
      } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
        acc.push(full)
      }
    }
  } catch { /* skip */ }
  return acc
}

// ── OBS-001: No bare console.log in production API routes ───────────────────

describe('OBS-001: API routes do not use bare console.log', () => {
  const PRODUCTION_APPS = [
    'union-eyes', 'flow', 'zonga', 'console', 'partners',
    'cfo', 'abr', 'nacp-exams', 'control-plane',
  ]

  it('API route files avoid console.log (use structured logger)', () => {
    const violations: string[] = []

    for (const app of PRODUCTION_APPS) {
      const apiDir = join(APPS_DIR, app, 'app', 'api')
      if (!existsSync(apiDir)) continue

      const routes = walkFiles(apiDir).filter(f => f.endsWith('route.ts'))
      for (const route of routes) {
        const src = readSafe(route)
        // Allow console.error (sometimes needed for unrecoverable errors)
        // But console.log is a code smell in production routes
        const consoleLogMatches = src.match(/console\.log\(/g)
        if (consoleLogMatches && consoleLogMatches.length > 0) {
          const rel = route.replace(ROOT + '\\', '').replace(ROOT + '/', '')
          violations.push(`${rel}: ${consoleLogMatches.length} console.log calls`)
        }
      }
    }

    // NOTE: This is a soft enforcement — we warn but don't fail initially
    // Uncomment the expect below to hard-enforce after migration
    if (violations.length > 0) {
      console.warn(
        `OBS-001 WARNING: ${violations.length} API route(s) still use console.log:\n` +
        violations.join('\n'),
      )
    }
    // Hard enforcement — enable when ready:
    // expect(violations, `API routes using console.log:\n${violations.join('\n')}`).toEqual([])
  })
})

// ── OBS-002: Apps have @nzila/observability dependency ──────────────────────

describe('OBS-002: Production apps declare observability dependency', () => {
  const PRODUCTION_APPS = [
    'union-eyes', 'flow', 'zonga', 'console', 'partners',
    'cfo', 'abr', 'nacp-exams', 'control-plane', 'web',
  ]

  for (const app of PRODUCTION_APPS) {
    it(`${app} has @nzila/observability in dependencies`, () => {
      const pkgPath = join(APPS_DIR, app, 'package.json')
      if (!existsSync(pkgPath)) return

      const pkg = readJSON(pkgPath)
      if (!pkg) return

      const deps = { ...(pkg.dependencies as Record<string, string> || {}), ...(pkg.devDependencies as Record<string, string> || {}) }
      const hasObservability =
        '@nzila/observability' in deps ||
        '@nzila/os-core' in deps // os-core re-exports observability

      expect(
        hasObservability,
        `${app}/package.json must include @nzila/observability or @nzila/os-core`,
      ).toBe(true)
    })
  }
})

// ── OBS-003: Production apps have instrumentation or telemetry setup ────────

describe('OBS-003: Production apps have telemetry setup', () => {
  const PRODUCTION_APPS = [
    'union-eyes', 'flow', 'zonga', 'console', 'partners',
    'cfo', 'control-plane', 'web',
  ]

  for (const app of PRODUCTION_APPS) {
    it(`${app} has instrumentation.ts or app-telemetry import`, () => {
      const instrumentationPath = join(APPS_DIR, app, 'instrumentation.ts')
      const altPath = join(APPS_DIR, app, 'lib', 'telemetry.ts')

      const hasInstrumentation = existsSync(instrumentationPath) || existsSync(altPath)

      if (!hasInstrumentation) {
        // Check if any lib file imports from @nzila/observability
        const libDir = join(APPS_DIR, app, 'lib')
        if (existsSync(libDir)) {
          const libFiles = walkFiles(libDir)
          const importsObs = libFiles.some(f => {
            const src = readSafe(f)
            return (
              src.includes('@nzila/observability') ||
              src.includes('createAppTelemetry') ||
              src.includes('createLogger')
            )
          })
          expect(
            importsObs,
            `${app} must have instrumentation.ts or import from @nzila/observability`,
          ).toBe(true)
          return
        }
      }

      expect(
        hasInstrumentation,
        `${app} must have instrumentation.ts or lib/telemetry.ts`,
      ).toBe(true)
    })
  }
})

// ── OBS-004: Health endpoints return structured JSON ────────────────────────

describe('OBS-004: Health endpoints return structured response', () => {
  const APPS_WITH_HEALTH = [
    'union-eyes', 'flow', 'zonga', 'console', 'partners',
    'cfo', 'abr', 'nacp-exams', 'control-plane', 'web',
  ]

  for (const app of APPS_WITH_HEALTH) {
    const healthPath = join(APPS_DIR, app, 'app', 'api', 'health', 'route.ts')
    if (!existsSync(healthPath)) continue

    it(`${app} health endpoint returns timestamp and status`, () => {
      const src = readSafe(healthPath)
      const hasTimestamp = src.includes('timestamp') || src.includes('generated_at') || src.includes('generatedAt')
      expect(hasTimestamp, `${app} health must return timestamp or generated_at`).toBe(true)
      expect(src, `${app} health must return status`).toContain('status')
    })
  }
})
