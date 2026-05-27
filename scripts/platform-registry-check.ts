/**
 * Platform Registry Check — validates the canonical platform registry
 * JSON shape, ensures all referenced paths exist, and verifies that
 * production apps/services have required metadata.
 *
 * Usage: pnpm exec tsx scripts/platform-registry-check.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const REGISTRY_PATH = path.join(ROOT, 'platform', 'registry', 'platform-registry.json')
const APPS_PATH = path.join(ROOT, 'platform', 'registry', 'apps.json')
const LAYERS_PATH = path.join(ROOT, 'platform', 'registry', 'layers.json')

interface Violation {
  section: string
  issue: string
  severity: 'error' | 'warning'
}

const violations: Violation[] = []

// ── Validate registry files exist ───────────────────

const requiredFiles = [
  { path: REGISTRY_PATH, name: 'platform-registry.json' },
  { path: APPS_PATH, name: 'apps.json' },
  { path: LAYERS_PATH, name: 'layers.json' },
]

for (const file of requiredFiles) {
  if (!fs.existsSync(file.path)) {
    process.stderr.write(`✗ Missing platform/registry/${file.name}\n`)
    process.exit(1)
  }
}

// ── Load registries ─────────────────────────────────

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'))
const appsRegistry = JSON.parse(fs.readFileSync(APPS_PATH, 'utf-8'))

// ── Validate JSON shape ─────────────────────────────

const requiredSections = ['apps', 'platform_services', 'shared_packages', 'governance_surfaces', 'control_plane_surfaces']
for (const section of requiredSections) {
  if (!Array.isArray(registry[section])) {
    violations.push({
      section: 'schema',
      issue: `Missing or invalid section: ${section} (expected array)`,
      severity: 'error',
    })
  }
}

// ── Validate app paths exist ────────────────────────

if (Array.isArray(registry.apps)) {
  for (const app of registry.apps) {
    if (!app.name || !app.path) {
      violations.push({ section: 'apps', issue: `App entry missing name or path`, severity: 'error' })
      continue
    }
    if (!fs.existsSync(path.join(ROOT, app.path))) {
      violations.push({ section: 'apps', issue: `App ${app.name}: path ${app.path} does not exist`, severity: 'error' })
    }
    if (!app.tier) {
      violations.push({ section: 'apps', issue: `App ${app.name}: missing tier`, severity: 'error' })
    }
    if (!app.owner) {
      violations.push({ section: 'apps', issue: `App ${app.name}: missing owner`, severity: 'error' })
    }
  }
}

// ── Validate platform service paths exist ───────────

if (Array.isArray(registry.platform_services)) {
  for (const svc of registry.platform_services) {
    if (!svc.name || !svc.path) {
      violations.push({ section: 'platform_services', issue: `Service entry missing name or path`, severity: 'error' })
      continue
    }
    if (!fs.existsSync(path.join(ROOT, svc.path))) {
      violations.push({ section: 'platform_services', issue: `Service ${svc.name}: path ${svc.path} does not exist`, severity: 'error' })
    }
    if (!svc.owner) {
      violations.push({ section: 'platform_services', issue: `Service ${svc.name}: missing owner`, severity: 'warning' })
    }
    if (!svc.lifecycle) {
      violations.push({ section: 'platform_services', issue: `Service ${svc.name}: missing lifecycle`, severity: 'warning' })
    }
  }
}

// ── Validate governance surface paths ───────────────

if (Array.isArray(registry.governance_surfaces)) {
  for (const surface of registry.governance_surfaces) {
    if (!surface.name || !surface.path) {
      violations.push({ section: 'governance_surfaces', issue: `Governance surface missing name or path`, severity: 'error' })
      continue
    }
    if (!fs.existsSync(path.join(ROOT, surface.path))) {
      violations.push({ section: 'governance_surfaces', issue: `Surface ${surface.name}: path ${surface.path} does not exist`, severity: 'warning' })
    }
  }
}

// ── Cross-check: all filesystem apps represented ────

const filesystemApps = fs.readdirSync(path.join(ROOT, 'apps'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

const registryAppNames = new Set((registry.apps || []).map((a: { name: string }) => a.name))

for (const app of filesystemApps) {
  if (!registryAppNames.has(app)) {
    violations.push({
      section: 'completeness',
      issue: `App ${app} exists on filesystem but not in platform-registry.json`,
      severity: 'error',
    })
  }
}

// ── Cross-check: apps.json and platform-registry.json consistency ──

const detailedAppNames = new Set((appsRegistry.apps || []).map((a: { name: string }) => a.name))
for (const appName of registryAppNames) {
  if (!detailedAppNames.has(appName)) {
    violations.push({
      section: 'consistency',
      issue: `App ${appName} in platform-registry.json but missing from apps.json`,
      severity: 'warning',
    })
  }
}

// ── Report ──────────────────────────────────────────

const errors = violations.filter((v) => v.severity === 'error')
const warnings = violations.filter((v) => v.severity === 'warning')

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Platform Registry Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')
process.stdout.write(`  Apps:              ${(registry.apps || []).length}\n`)
process.stdout.write(`  Platform Services: ${(registry.platform_services || []).length}\n`)
process.stdout.write(`  Shared Packages:   ${(registry.shared_packages || []).length}\n`)
process.stdout.write(`  Errors:            ${errors.length}\n`)
process.stdout.write(`  Warnings:          ${warnings.length}\n\n`)

if (errors.length > 0) {
  for (const v of errors) {
    process.stderr.write(`  ✗ [${v.section}] ${v.issue}\n`)
  }
  process.stderr.write('\n')
}

if (warnings.length > 0) {
  for (const v of warnings) {
    process.stderr.write(`  ⚠ [${v.section}] ${v.issue}\n`)
  }
  process.stderr.write('\n')
}

if (errors.length > 0) {
  process.stderr.write('  See platform/registry/platform-registry.json for reference.\n\n')
  process.exit(1)
} else {
  process.stdout.write('  ✓ Platform registry is valid\n\n')
}
