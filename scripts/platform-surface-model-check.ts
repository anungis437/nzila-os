/**
 * Platform Surface Model Check — validates that routes across all platform surfaces
 * are documented and comply with the capability model defined in platform-surfaces.json.
 *
 * Checks:
 * 1. Every platform surface app has a route.meta.json
 * 2. Every route declares feature_class and owning_surface
 * 3. feature_class values are within allowed_capabilities for the owning surface
 * 4. No feature_class appears in forbidden_capabilities
 * 5. Discovered routes on disk are documented in route.meta.json
 *
 * Usage: pnpm platform:surface:model:check
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const SURFACES_PATH = path.join(ROOT, 'platform', 'registry', 'platform-surfaces.json')
const SURFACE_APPS = ['control-plane', 'console', 'platform-admin'] as const

interface SurfaceConfig {
  role: string
  path: string
  allowed_capabilities: string[]
  forbidden_capabilities: string[]
}

interface SurfacesRegistry {
  surfaces: Record<string, SurfaceConfig>
}

interface RouteEntry {
  route?: string
  path?: string
  feature_class?: string
  owning_surface?: string
  primary_user?: string
  purpose?: string
  bucket?: string
}

interface RouteMeta {
  routes: RouteEntry[]
}

interface Violation {
  surface: string
  issue: string
  severity: 'error' | 'warning'
}

const violations: Violation[] = []

// ── Load surface registry ───────────────────────────

if (!fs.existsSync(SURFACES_PATH)) {
  process.stderr.write('✗ Missing platform/registry/platform-surfaces.json\n')
  process.exit(1)
}

const registry: SurfacesRegistry = JSON.parse(fs.readFileSync(SURFACES_PATH, 'utf-8'))

// ── Discover routes on disk ─────────────────────────

function discoverRoutes(appName: string): string[] {
  const routes: string[] = []

  // Next.js App Router — look for page.tsx under (dashboard)/ or direct app/
  const dashboardDir = path.join(ROOT, 'apps', appName, 'app', '(dashboard)')
  const appDir = path.join(ROOT, 'apps', appName, 'app')

  const scanDir = fs.existsSync(dashboardDir) ? dashboardDir : appDir
  if (!fs.existsSync(scanDir)) return routes

  const walk = (dir: string, prefix: string): void => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (['api', 'sign-in', 'sign-up', '(marketing)', 'node_modules', '.next'].includes(entry.name)) continue

        const subDir = path.join(dir, entry.name)
        const routePath = `${prefix}/${entry.name}`

        if (fs.existsSync(path.join(subDir, 'page.tsx')) || fs.existsSync(path.join(subDir, 'page.ts'))) {
          routes.push(routePath)
        }

        walk(subDir, routePath)
      }
    } catch {
      // Skip unreadable directories
    }
  }

  // Also check root page.tsx
  if (fs.existsSync(path.join(scanDir, 'page.tsx'))) {
    routes.push('/')
  }

  walk(scanDir, '')

  return routes
}

// ── Validate each surface ───────────────────────────

for (const appName of SURFACE_APPS) {
  const metaPath = path.join(ROOT, 'apps', appName, 'route.meta.json')
  const surfaceConfig = registry.surfaces[appName]

  if (!surfaceConfig) {
    violations.push({
      surface: appName,
      issue: `Surface "${appName}" not defined in platform-surfaces.json`,
      severity: 'error',
    })
    continue
  }

  // Check route.meta.json exists
  if (!fs.existsSync(metaPath)) {
    violations.push({
      surface: appName,
      issue: 'Missing route.meta.json',
      severity: 'error',
    })
    continue
  }

  const meta: RouteMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  const documentedRoutes = new Set(meta.routes.map((r) => r.route ?? r.path ?? ''))

  // Validate each documented route
  for (const entry of meta.routes) {
    const routePath = entry.route ?? entry.path ?? '<unknown>'

    // Check feature_class exists
    const featureClass = entry.feature_class ?? entry.bucket?.toLowerCase()
    if (!featureClass) {
      violations.push({
        surface: appName,
        issue: `Route ${routePath}: missing feature_class`,
        severity: 'error',
      })
      continue
    }

    // Check feature_class is in allowed_capabilities
    if (!surfaceConfig.allowed_capabilities.includes(featureClass)) {
      // Control-plane uses bucket model — map buckets to allowed capabilities
      const bucketMapped = entry.bucket?.toLowerCase()
      if (bucketMapped && ['health', 'attention', 'action'].includes(bucketMapped)) {
        // Bucket-model routes in control-plane are allowed by design
        continue
      }

      violations.push({
        surface: appName,
        issue: `Route ${routePath}: feature_class "${featureClass}" not in allowed_capabilities`,
        severity: 'warning',
      })
    }

    // Check feature_class is not in forbidden_capabilities
    if (surfaceConfig.forbidden_capabilities.includes(featureClass)) {
      violations.push({
        surface: appName,
        issue: `Route ${routePath}: feature_class "${featureClass}" is in forbidden_capabilities`,
        severity: 'error',
      })
    }

    // Check required fields
    if (!entry.primary_user) {
      violations.push({
        surface: appName,
        issue: `Route ${routePath}: missing primary_user`,
        severity: 'warning',
      })
    }

    if (!entry.purpose && !entry.actionability) {
      violations.push({
        surface: appName,
        issue: `Route ${routePath}: missing purpose description`,
        severity: 'warning',
      })
    }
  }

  // Discover routes on disk and check for undocumented ones
  const diskRoutes = discoverRoutes(appName)
  for (const route of diskRoutes) {
    if (!documentedRoutes.has(route)) {
      violations.push({
        surface: appName,
        issue: `Undocumented route on disk: ${route} — add to route.meta.json`,
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
process.stdout.write('  Platform Surface Model Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')

for (const appName of SURFACE_APPS) {
  const count = violations.filter((v) => v.surface === appName).length
  const metaExists = fs.existsSync(path.join(ROOT, 'apps', appName, 'route.meta.json'))
  process.stdout.write(`  ${metaExists ? '✓' : '✗'} ${appName}: ${count} issue(s)\n`)
}

process.stdout.write(`\n  Errors:   ${errors.length}\n`)
process.stdout.write(`  Warnings: ${warnings.length}\n\n`)

if (errors.length > 0) {
  for (const v of errors) {
    process.stderr.write(`  ✗ [${v.surface}] ${v.issue}\n`)
  }
  process.stderr.write('\n')
}

if (warnings.length > 0) {
  for (const v of warnings) {
    process.stderr.write(`  ⚠ [${v.surface}] ${v.issue}\n`)
  }
  process.stderr.write('\n')
}

if (errors.length > 0) {
  process.stderr.write('  See docs/PLATFORM_SURFACE_MODEL.md for guidance.\n\n')
  process.exit(1)
} else {
  process.stdout.write('  ✓ All platform surfaces comply with surface model\n\n')
}
