/**
 * App Lifecycle Check — validates that every app in apps/ is registered
 * in platform/registry/apps.json with a lifecycle tier, and that
 * PRODUCTION/PILOT apps meet required capability thresholds.
 *
 * Usage: pnpm exec tsx scripts/app-lifecycle-check.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const APPS_DIR = path.join(ROOT, 'apps')
const REGISTRY_PATH = path.join(ROOT, 'platform', 'registry', 'apps.json')

const VALID_TIERS = ['PRODUCTION', 'PILOT', 'INCUBATING', 'EXPERIMENTAL'] as const

interface AppEntry {
  name: string
  path: string
  tier: string
  owner: string
  domain: string
  health_endpoint: boolean
  metrics_endpoint: boolean
  evidence_export: boolean
  demo_seed: boolean
  docs_complete: boolean
}

interface Violation {
  app: string
  issue: string
  severity: 'error' | 'warning'
}

const violations: Violation[] = []

// ── Load registry ───────────────────────────────────

if (!fs.existsSync(REGISTRY_PATH)) {
  process.stderr.write('✗ Missing platform/registry/apps.json\n')
  process.exit(1)
}

const registry: { apps: AppEntry[] } = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'))
const registeredApps = new Map(registry.apps.map((a) => [a.name, a]))

// ── Discover all apps ───────────────────────────────

const allApps = fs.readdirSync(APPS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

// ── Check: every app is registered ──────────────────

for (const app of allApps) {
  if (!registeredApps.has(app)) {
    violations.push({
      app,
      issue: 'Not registered in platform/registry/apps.json',
      severity: 'error',
    })
  }
}

// ── Check: every registered app exists ──────────────

for (const entry of registry.apps) {
  if (!fs.existsSync(path.join(ROOT, entry.path))) {
    violations.push({
      app: entry.name,
      issue: `Registered path ${entry.path} does not exist`,
      severity: 'error',
    })
  }
}

// ── Check: valid tier ───────────────────────────────

for (const entry of registry.apps) {
  if (!VALID_TIERS.includes(entry.tier as (typeof VALID_TIERS)[number])) {
    violations.push({
      app: entry.name,
      issue: `Invalid tier "${entry.tier}" — must be ${VALID_TIERS.join(', ')}`,
      severity: 'error',
    })
  }
}

// ── Check: required metadata ────────────────────────

for (const entry of registry.apps) {
  if (!entry.owner) {
    violations.push({ app: entry.name, issue: 'Missing owner', severity: 'error' })
  }
  if (!entry.domain) {
    violations.push({ app: entry.name, issue: 'Missing domain', severity: 'error' })
  }
}

// ── Tier-specific validation ────────────────────────

function countTestFiles(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0
  let count = 0
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
        walk(full)
      } else if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) {
        count++
      }
    }
  }
  walk(dirPath)
  return count
}

for (const entry of registry.apps) {
  const appDir = path.join(ROOT, entry.path)
  if (!fs.existsSync(appDir)) continue

  const tier = entry.tier

  if (tier === 'PRODUCTION' || tier === 'PILOT') {
    // Must have tests
    const testCount = countTestFiles(appDir)
    const minTests = tier === 'PRODUCTION' ? 3 : 1
    if (testCount < minTests) {
      violations.push({
        app: entry.name,
        issue: `${tier} app has ${testCount} test files (minimum ${minTests})`,
        severity: 'error',
      })
    }

    // Must have docs directory
    if (!fs.existsSync(path.join(appDir, 'docs'))) {
      violations.push({
        app: entry.name,
        issue: `${tier} app missing docs/ directory`,
        severity: tier === 'PRODUCTION' ? 'error' : 'warning',
      })
    }

    // Must have typecheck script
    const pkgPath = path.join(appDir, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      if (!pkg.scripts?.typecheck) {
        violations.push({
          app: entry.name,
          issue: `${tier} app missing typecheck script`,
          severity: 'warning',
        })
      }
    }

    // PRODUCTION: health endpoint required
    if (tier === 'PRODUCTION') {
      const hasHealth = fs.existsSync(path.join(appDir, 'app', 'api', 'health', 'route.ts'))
      if (!hasHealth && entry.health_endpoint) {
        violations.push({
          app: entry.name,
          issue: 'PRODUCTION app: health endpoint declared but route.ts not found',
          severity: 'error',
        })
      }
    }
  }
}

// ── Report ──────────────────────────────────────────

const errors = violations.filter((v) => v.severity === 'error')
const warnings = violations.filter((v) => v.severity === 'warning')

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  App Lifecycle Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')
process.stdout.write(`  Apps discovered: ${allApps.length}\n`)
process.stdout.write(`  Apps registered: ${registry.apps.length}\n`)
process.stdout.write(`  Errors:          ${errors.length}\n`)
process.stdout.write(`  Warnings:        ${warnings.length}\n\n`)

// Tier summary
const tierCounts: Record<string, number> = {}
for (const entry of registry.apps) {
  tierCounts[entry.tier] = (tierCounts[entry.tier] || 0) + 1
}
for (const tier of VALID_TIERS) {
  process.stdout.write(`  ${tier}: ${tierCounts[tier] || 0} app(s)\n`)
}
process.stdout.write('\n')

if (errors.length > 0) {
  for (const v of errors) {
    process.stderr.write(`  ✗ [${v.app}] ${v.issue}\n`)
  }
  process.stderr.write('\n')
}

if (warnings.length > 0) {
  for (const v of warnings) {
    process.stderr.write(`  ⚠ [${v.app}] ${v.issue}\n`)
  }
  process.stderr.write('\n')
}

if (errors.length > 0) {
  process.stderr.write('  See docs/governance/APP_LIFECYCLE_MATRIX.md for guidance.\n\n')
  process.exit(1)
} else {
  process.stdout.write('  ✓ All apps are lifecycle-compliant\n\n')
}
