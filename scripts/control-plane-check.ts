/**
 * Control Plane Route Check — verifies every page in the control-plane
 * dashboard has an entry in route.meta.json with a valid bucket.
 *
 * Usage: pnpm exec tsx scripts/control-plane-check.ts
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
  routes: RouteEntry[]
}

interface Violation {
  issue: string
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
    violations.push({ issue: `Undocumented route: ${route} — add to route.meta.json` })
  }
}

// ── Validate manifest entries ───────────────────────

for (const entry of meta.routes) {
  if (!VALID_BUCKETS.includes(entry.bucket as (typeof VALID_BUCKETS)[number])) {
    violations.push({ issue: `Route ${entry.path}: invalid bucket "${entry.bucket}" — must be HEALTH, ATTENTION, or ACTION` })
  }

  if (!entry.name || typeof entry.name !== 'string') {
    violations.push({ issue: `Route ${entry.path}: missing or invalid name` })
  }

  if (!entry.primary_user || typeof entry.primary_user !== 'string') {
    violations.push({ issue: `Route ${entry.path}: missing primary_user` })
  }

  if (!entry.actionability || typeof entry.actionability !== 'string') {
    violations.push({ issue: `Route ${entry.path}: missing actionability description` })
  }
}

// ── Report ──────────────────────────────────────────

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Control Plane Route Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')
process.stdout.write(`  Dashboard routes discovered: ${discoveredRoutes.length}\n`)
process.stdout.write(`  Manifest entries:            ${meta.routes.length}\n`)
process.stdout.write(`  Violations:                  ${violations.length}\n\n`)

if (violations.length > 0) {
  for (const v of violations) {
    process.stderr.write(`  ✗ ${v.issue}\n`)
  }
  process.stderr.write('\n  See docs/CONTROL_PLANE_PRINCIPLES.md for guidance.\n\n')
  process.exit(1)
} else {
  process.stdout.write('  ✓ All control-plane routes are governed\n\n')
}
