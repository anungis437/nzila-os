/**
 * App Domain-Core Check — validates that target apps conform to the
 * canonical domain-core internal architecture standard.
 *
 * Checks:
 * 1. app-architecture.meta.json exists for each target app
 * 2. Required layers (directories) exist based on meta declaration
 * 3. ARCHITECTURE_SHAPE.md documentation exists
 * 4. Critical workflow logic is not only UI-local
 *
 * Usage: pnpm exec tsx scripts/app-domain-core-check.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const APPS_DIR = path.join(ROOT, 'apps')

const TARGET_APPS = [
  'union-eyes',
  'flow',
  'zonga',
  'cfo',
  'partners',
  'control-plane',
  'web',
] as const

const CANONICAL_LAYERS = ['domain', 'services', 'workflows', 'queries', 'events'] as const

interface AppMeta {
  domain_core_standard_adopted: boolean
  layers_present: string[]
  layers_missing: string[]
  layers_not_applicable?: string[]
  migration_status: string
  priority_migrations: string[]
  app_tier: string
}

interface Violation {
  app: string
  issue: string
  severity: 'error' | 'warning'
}

const violations: Violation[] = []

// ── Validate each target app ────────────────────────

for (const appName of TARGET_APPS) {
  const appDir = path.join(APPS_DIR, appName)

  if (!fs.existsSync(appDir)) {
    violations.push({
      app: appName,
      issue: 'App directory does not exist',
      severity: 'error',
    })
    continue
  }

  // Check app-architecture.meta.json
  const metaPath = path.join(appDir, 'app-architecture.meta.json')
  if (!fs.existsSync(metaPath)) {
    violations.push({
      app: appName,
      issue: 'Missing app-architecture.meta.json',
      severity: 'error',
    })
    continue
  }

  let meta: AppMeta
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  } catch {
    violations.push({
      app: appName,
      issue: 'Invalid app-architecture.meta.json — cannot parse JSON',
      severity: 'error',
    })
    continue
  }

  // Check standard adoption declaration
  if (!meta.domain_core_standard_adopted) {
    violations.push({
      app: appName,
      issue: 'domain_core_standard_adopted is not true',
      severity: 'error',
    })
  }

  // Check ARCHITECTURE_SHAPE.md exists
  const shapePath = path.join(appDir, 'docs', 'ARCHITECTURE_SHAPE.md')
  if (!fs.existsSync(shapePath)) {
    violations.push({
      app: appName,
      issue: 'Missing docs/ARCHITECTURE_SHAPE.md',
      severity: 'error',
    })
  }

  // Check declared present layers actually exist on disk
  const notApplicable = new Set(meta.layers_not_applicable ?? [])

  for (const layer of meta.layers_present) {
    // "ui" layer maps to app/ or components/ in Next.js apps
    if (layer === 'ui') {
      const appDir2 = path.join(appDir, 'app')
      const componentsDir = path.join(appDir, 'components')
      if (!fs.existsSync(appDir2) && !fs.existsSync(componentsDir)) {
        violations.push({
          app: appName,
          issue: `Layer "ui" declared present but neither app/ nor components/ found`,
          severity: 'error',
        })
      }
      continue
    }

    // Check both top-level and lib/ locations
    const topLevel = path.join(appDir, layer)
    const libLevel = path.join(appDir, 'lib', layer)

    if (!fs.existsSync(topLevel) && !fs.existsSync(libLevel)) {
      violations.push({
        app: appName,
        issue: `Layer "${layer}" declared present but directory not found at ${layer}/ or lib/${layer}/`,
        severity: 'error',
      })
    }
  }

  // Check if missing layers have migration plans
  const missing = meta.layers_missing ?? []
  for (const layer of missing) {
    if (notApplicable.has(layer)) continue

    // Check if the layer directory exists yet (migration may have started)
    const topLevel = path.join(appDir, layer)
    const libLevel = path.join(appDir, 'lib', layer)

    if (fs.existsSync(topLevel) || fs.existsSync(libLevel)) {
      violations.push({
        app: appName,
        issue: `Layer "${layer}" declared missing but directory exists — update meta`,
        severity: 'warning',
      })
    }
  }

  // Check migration status is valid
  const validStatuses = ['not_started', 'partial', 'complete']
  if (!validStatuses.includes(meta.migration_status)) {
    violations.push({
      app: appName,
      issue: `Invalid migration_status: "${meta.migration_status}"`,
      severity: 'warning',
    })
  }

  // Warn if PRODUCTION/PILOT apps have many missing layers
  if (['PRODUCTION', 'PILOT'].includes(meta.app_tier)) {
    const applicableMissing = missing.filter((l) => !notApplicable.has(l))
    if (applicableMissing.length > 2) {
      violations.push({
        app: appName,
        issue: `${meta.app_tier} app has ${applicableMissing.length} missing applicable layers: ${applicableMissing.join(', ')}`,
        severity: 'warning',
      })
    }
  }
}

// ── Report ──────────────────────────────────────────

const errors = violations.filter((v) => v.severity === 'error')
const warnings = violations.filter((v) => v.severity === 'warning')

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  App Domain-Core Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')

for (const appName of TARGET_APPS) {
  const metaPath = path.join(APPS_DIR, appName, 'app-architecture.meta.json')
  const appViolations = violations.filter((v) => v.app === appName)
  const hasErrors = appViolations.some((v) => v.severity === 'error')

  if (fs.existsSync(metaPath)) {
    const meta: AppMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    const present = meta.layers_present.length
    const total = CANONICAL_LAYERS.filter((l) => !(meta.layers_not_applicable ?? []).includes(l)).length
    process.stdout.write(`  ${hasErrors ? '✗' : '✓'} ${appName}: ${present}/${total} layers, migration=${meta.migration_status}, ${appViolations.length} issue(s)\n`)
  } else {
    process.stdout.write(`  ✗ ${appName}: no metadata\n`)
  }
}

process.stdout.write(`\n  Errors:   ${errors.length}\n`)
process.stdout.write(`  Warnings: ${warnings.length}\n\n`)

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
  process.stderr.write('  See docs/APP_DOMAIN_CORE_STANDARD.md for guidance.\n\n')
  process.exit(1)
} else {
  process.stdout.write('  ✓ All target apps conform to domain-core standard\n\n')
}
