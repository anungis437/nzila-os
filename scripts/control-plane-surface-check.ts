/**
 * Control Plane Surface Check — validates control-plane routes against
 * route.meta.json, checks bucket assignments, and detects undocumented routes.
 *
 * This extends the existing control-plane-check.ts with additional surface
 * responsibility validation.
 *
 * Usage: pnpm exec tsx scripts/control-plane-surface-check.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const CP_DIR = path.join(ROOT, 'apps', 'control-plane')
const DASHBOARD_DIR = path.join(CP_DIR, 'app', '(dashboard)')
const META_PATH = path.join(CP_DIR, 'route.meta.json')
const REGISTRY_PATH = path.join(ROOT, 'platform', 'registry', 'platform-registry.json')

const VALID_BUCKETS = ['HEALTH', 'ATTENTION', 'ACTION'] as const

interface RouteEntry {
  path: string
  name: string
  bucket: string
  primary_user: string
  actionability: string
  source: string
}

interface RouteMeta {
  description?: string
  routes: RouteEntry[]
}

interface Violation {
  issue: string
  severity: 'error' | 'warning'
}

const violations: Violation[] = []

// ── Load manifest ───────────────────────────────────

if (!fs.existsSync(META_PATH)) {
  process.stderr.write('✗ Missing apps/control-plane/route.meta.json\n')
  process.exit(1)
}

const meta: RouteMeta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'))
const registeredPaths = new Set(meta.routes.map((r) => r.path))

// ── Discover dashboard routes ───────────────────────

const dashboardDirs = fs.readdirSync(DASHBOARD_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

const discoveredRoutes: string[] = []
for (const dir of dashboardDirs) {
  const pagePath = path.join(DASHBOARD_DIR, dir, 'page.tsx')
  if (fs.existsSync(pagePath)) {
    discoveredRoutes.push(`/${dir}`)
  }
}

// ── Check all discovered routes are registered ──────

for (const route of discoveredRoutes) {
  if (!registeredPaths.has(route)) {
    violations.push({
      issue: `Undocumented route: ${route} — add to route.meta.json`,
      severity: 'error',
    })
  }
}

// ── Validate manifest entries ───────────────────────

for (const entry of meta.routes) {
  if (!VALID_BUCKETS.includes(entry.bucket as (typeof VALID_BUCKETS)[number])) {
    violations.push({
      issue: `Route ${entry.path}: invalid bucket "${entry.bucket}" — must be HEALTH, ATTENTION, or ACTION`,
      severity: 'error',
    })
  }

  if (!entry.name || typeof entry.name !== 'string') {
    violations.push({ issue: `Route ${entry.path}: missing or invalid name`, severity: 'error' })
  }

  if (!entry.primary_user || typeof entry.primary_user !== 'string') {
    violations.push({ issue: `Route ${entry.path}: missing primary_user`, severity: 'error' })
  }

  if (!entry.actionability || typeof entry.actionability !== 'string') {
    violations.push({ issue: `Route ${entry.path}: missing actionability description`, severity: 'error' })
  }

  if (!entry.source || typeof entry.source !== 'string') {
    violations.push({ issue: `Route ${entry.path}: missing source`, severity: 'warning' })
  }
}

// ── Cross-check with platform registry ──────────────

if (fs.existsSync(REGISTRY_PATH)) {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'))
  const registrySurfaces = new Set(
    (registry.control_plane_surfaces || []).map((s: { route: string }) => s.route)
  )

  for (const entry of meta.routes) {
    if (!registrySurfaces.has(entry.path)) {
      violations.push({
        issue: `Route ${entry.path} in route.meta.json but missing from platform-registry.json control_plane_surfaces`,
        severity: 'warning',
      })
    }
  }
}

// ── Validate bucket distribution (heuristic) ────────

const bucketCounts: Record<string, number> = {}
for (const entry of meta.routes) {
  bucketCounts[entry.bucket] = (bucketCounts[entry.bucket] || 0) + 1
}

const total = meta.routes.length
if (total > 5 && !bucketCounts['HEALTH']) {
  violations.push({
    issue: 'No HEALTH routes — control plane must monitor platform health',
    severity: 'warning',
  })
}
if (total > 5 && !bucketCounts['ATTENTION']) {
  violations.push({
    issue: 'No ATTENTION routes — control plane must surface items needing attention',
    severity: 'warning',
  })
}

// ── Report ──────────────────────────────────────────

const errors = violations.filter((v) => v.severity === 'error')
const warnings = violations.filter((v) => v.severity === 'warning')

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Control Plane Surface Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')
process.stdout.write(`  Dashboard routes:  ${discoveredRoutes.length}\n`)
process.stdout.write(`  Manifest entries:  ${meta.routes.length}\n`)
for (const bucket of VALID_BUCKETS) {
  process.stdout.write(`  ${bucket}: ${bucketCounts[bucket] || 0}\n`)
}
process.stdout.write(`\n  Errors:   ${errors.length}\n`)
process.stdout.write(`  Warnings: ${warnings.length}\n\n`)

if (errors.length > 0) {
  for (const v of errors) {
    process.stderr.write(`  ✗ ${v.issue}\n`)
  }
  process.stderr.write('\n')
}

if (warnings.length > 0) {
  for (const v of warnings) {
    process.stderr.write(`  ⚠ ${v.issue}\n`)
  }
  process.stderr.write('\n')
}

if (errors.length > 0) {
  process.stderr.write('  See docs/governance/PLATFORM_SURFACE_RESPONSIBILITIES.md for guidance.\n\n')
  process.exit(1)
} else {
  process.stdout.write('  ✓ All control-plane surfaces are governed\n\n')
}
