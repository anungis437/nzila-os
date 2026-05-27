/**
 * Registry Consistency Check — validates all registry files are
 * internally consistent and cross-referenced correctly.
 *
 * Extends platform-registry-check.ts with:
 * - environments.json validation
 * - platform-surfaces.json cross-check
 * - app-architecture.meta.json ↔ apps.json tier alignment
 * - Contract package existence validation
 *
 * Usage: pnpm exec tsx scripts/registry-consistency-check.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const REGISTRY_DIR = path.join(ROOT, 'platform', 'registry')
const APPS_DIR = path.join(ROOT, 'apps')

const REGISTRY_FILES = [
  'apps.json',
  'layers.json',
  'platform-registry.json',
  'platform-surfaces.json',
  'environments.json',
] as const

interface Violation {
  scope: string
  issue: string
  severity: 'error' | 'warning'
}

const violations: Violation[] = []

// ── Check all registry files exist ──────────────────

for (const file of REGISTRY_FILES) {
  const filePath = path.join(REGISTRY_DIR, file)
  if (!fs.existsSync(filePath)) {
    violations.push({
      scope: 'registry',
      issue: `Missing registry file: ${file}`,
      severity: 'error',
    })
  }
}

// ── Load registries ─────────────────────────────────

function loadJson<T>(filename: string): T | null {
  const filePath = path.join(REGISTRY_DIR, filename)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

interface AppEntry {
  name: string
  path: string
  tier: string
  owner: string
  domain: string
}

const appsRegistry = loadJson<{ apps: AppEntry[] }>('apps.json')
const surfacesRegistry = loadJson<{
  surfaces: Record<string, { name?: string; path: string }>
}>('platform-surfaces.json')
const envRegistry = loadJson<{
  environments: Array<{
    name: string
    tier: string
    apps_deployed: string[] | 'all'
  }>
}>('environments.json')

// ── Validate environments.json ──────────────────────

if (envRegistry) {
  const validTiers = ['development', 'staging', 'production']
  const appNames = new Set(appsRegistry?.apps.map((a) => a.name) ?? [])

  for (const env of envRegistry.environments) {
    if (!validTiers.includes(env.tier)) {
      violations.push({
        scope: 'environments',
        issue: `Environment "${env.name}": invalid tier "${env.tier}"`,
        severity: 'error',
      })
    }

    if (Array.isArray(env.apps_deployed)) {
      for (const app of env.apps_deployed) {
        if (!appNames.has(app)) {
          violations.push({
            scope: 'environments',
            issue: `Environment "${env.name}": references unknown app "${app}"`,
            severity: 'error',
          })
        }
      }
    }
  }
}

// ── Cross-check surfaces ↔ route.meta.json ──────────

if (surfacesRegistry) {
  for (const [surfaceName, surface] of Object.entries(surfacesRegistry.surfaces)) {
    const metaPath = path.join(ROOT, surface.path, 'route.meta.json')
    if (!fs.existsSync(metaPath)) {
      violations.push({
        scope: 'surfaces',
        issue: `Surface "${surfaceName}" (${surface.path}): missing route.meta.json`,
        severity: 'warning',
      })
    }
  }
}

// ── Cross-check app tiers ↔ meta.json ───────────────

if (appsRegistry) {
  for (const app of appsRegistry.apps) {
    const metaPath = path.join(ROOT, app.path, 'app-architecture.meta.json')
    if (!fs.existsSync(metaPath)) continue

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    if (meta.app_tier && meta.app_tier !== app.tier) {
      violations.push({
        scope: 'cross-check',
        issue: `App "${app.name}": tier mismatch — apps.json="${app.tier}", meta.json="${meta.app_tier}"`,
        severity: 'error',
      })
    }
  }

  // Check app paths exist on filesystem
  for (const app of appsRegistry.apps) {
    const appPath = path.join(ROOT, app.path)
    if (!fs.existsSync(appPath)) {
      violations.push({
        scope: 'apps',
        issue: `App "${app.name}": path "${app.path}" does not exist`,
        severity: 'error',
      })
    }
  }
}

// ── Check platform-contracts package exists ─────────

const contractsPkg = path.join(ROOT, 'packages', 'platform-contracts', 'package.json')
if (!fs.existsSync(contractsPkg)) {
  violations.push({
    scope: 'contracts',
    issue: 'packages/platform-contracts does not exist — run Phase 3',
    severity: 'warning',
  })
}

const aiContractPkg = path.join(ROOT, 'packages', 'platform-ai-contract', 'package.json')
if (!fs.existsSync(aiContractPkg)) {
  violations.push({
    scope: 'contracts',
    issue: 'packages/platform-ai-contract does not exist',
    severity: 'warning',
  })
}

// ── Report ──────────────────────────────────────────

const errors = violations.filter((v) => v.severity === 'error')
const warnings = violations.filter((v) => v.severity === 'warning')

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Registry Consistency Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')

for (const file of REGISTRY_FILES) {
  const exists = fs.existsSync(path.join(REGISTRY_DIR, file))
  process.stdout.write(`  ${exists ? '✓' : '✗'} ${file}\n`)
}

process.stdout.write(`\n  Errors:   ${errors.length}\n`)
process.stdout.write(`  Warnings: ${warnings.length}\n\n`)

if (errors.length > 0) {
  for (const v of errors) {
    process.stderr.write(`  ✗ [${v.scope}] ${v.issue}\n`)
  }
  process.stderr.write('\n')
}

if (warnings.length > 0) {
  for (const v of warnings) {
    process.stderr.write(`  ⚠ [${v.scope}] ${v.issue}\n`)
  }
  process.stderr.write('\n')
}

if (errors.length > 0) {
  process.exit(1)
} else {
  process.stdout.write('  ✓ Registry consistency check passed\n\n')
}
