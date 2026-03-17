/**
 * Control Plane Coherence Check — validates cross-surface coherence
 * by detecting route duplication, verifying actionability scores,
 * and checking source contract alignment.
 *
 * Extends the existing control-plane-surface-check.ts with
 * cross-surface analysis (console, platform-admin overlap detection).
 *
 * Usage: pnpm control-plane:coherence:check
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const APPS_DIR = path.join(ROOT, 'apps')

const SURFACES = ['control-plane', 'console', 'platform-admin'] as const

const VALID_CONTRACTS = ['health', 'metrics', 'governance', 'evidence', 'environment', 'change']

interface RouteEntry {
  path?: string
  route?: string
  name?: string
  purpose?: string
  bucket?: string
  feature_class?: string
  primary_user?: string
  actionability?: string
  actionability_score?: number
  source?: string
  source_systems?: string[]
  source_contracts_used?: string[]
  duplication_risk?: string
  owning_surface?: string
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

// ── Load all surface manifests ──────────────────────

const surfaceRoutes: Record<string, RouteEntry[]> = {}

for (const surface of SURFACES) {
  const metaPath = path.join(APPS_DIR, surface, 'route.meta.json')
  if (!fs.existsSync(metaPath)) {
    violations.push({
      surface,
      issue: `Missing route.meta.json`,
      severity: 'warning',
    })
    continue
  }

  const meta: RouteMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  surfaceRoutes[surface] = meta.routes
}

// ── Cross-surface duplication detection ─────────────

const routePurposes: Map<string, { surface: string; path: string }[]> = new Map()

for (const [surface, routes] of Object.entries(surfaceRoutes)) {
  for (const entry of routes) {
    const routePath = entry.path ?? entry.route ?? ''
    const purpose = (entry.purpose ?? entry.actionability ?? entry.name ?? '').toLowerCase()

    // Extract keywords for fuzzy matching
    const keywords = purpose.split(/[\s,]+/).filter((w) => w.length > 3)
    for (const keyword of keywords) {
      const existing = routePurposes.get(keyword) ?? []
      existing.push({ surface, path: routePath })
      routePurposes.set(keyword, existing)
    }
  }
}

// Find keywords appearing in multiple surfaces
for (const [keyword, entries] of routePurposes) {
  const surfaces = new Set(entries.map((e) => e.surface))
  if (surfaces.size > 1) {
    const locations = entries.map((e) => `${e.surface}:${e.path}`).join(', ')
    violations.push({
      surface: 'cross-surface',
      issue: `Potential overlap on "${keyword}": ${locations}`,
      severity: 'warning',
    })
  }
}

// ── Control-plane specific V2 field checks ──────────

const cpRoutes = surfaceRoutes['control-plane'] ?? []

for (const entry of cpRoutes) {
  const routePath = entry.path ?? ''

  // Validate actionability_score (1-5)
  if (entry.actionability_score !== undefined) {
    if (entry.actionability_score < 1 || entry.actionability_score > 5) {
      violations.push({
        surface: 'control-plane',
        issue: `Route ${routePath}: actionability_score must be 1-5, got ${entry.actionability_score}`,
        severity: 'error',
      })
    }
  }

  // Validate source_contracts_used references
  if (entry.source_contracts_used) {
    for (const contract of entry.source_contracts_used) {
      if (!VALID_CONTRACTS.includes(contract)) {
        violations.push({
          surface: 'control-plane',
          issue: `Route ${routePath}: unknown contract "${contract}" — valid: ${VALID_CONTRACTS.join(', ')}`,
          severity: 'warning',
        })
      }
    }
  }

  // Flag high duplication risk
  if (entry.duplication_risk && entry.duplication_risk !== 'low') {
    violations.push({
      surface: 'control-plane',
      issue: `Route ${routePath}: duplication_risk="${entry.duplication_risk}" — needs migration plan`,
      severity: 'warning',
    })
  }
}

// ── Bucket balance (control-plane) ──────────────────

const bucketCounts: Record<string, number> = {}
for (const entry of cpRoutes) {
  const bucket = entry.bucket ?? 'UNKNOWN'
  bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1
}

const total = cpRoutes.length
if (total > 0) {
  const actionPct = ((bucketCounts['ACTION'] ?? 0) / total) * 100
  if (actionPct > 40) {
    violations.push({
      surface: 'control-plane',
      issue: `ACTION bucket is ${actionPct.toFixed(0)}% of routes — control plane should be observation-heavy, not action-heavy`,
      severity: 'warning',
    })
  }
}

// ── Report ──────────────────────────────────────────

const errors = violations.filter((v) => v.severity === 'error')
const warnings = violations.filter((v) => v.severity === 'warning')

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Control Plane Coherence Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')

for (const surface of SURFACES) {
  const routes = surfaceRoutes[surface]
  if (routes) {
    process.stdout.write(`  ${surface}: ${routes.length} routes\n`)
  } else {
    process.stdout.write(`  ${surface}: no manifest\n`)
  }
}

process.stdout.write('\n')
process.stdout.write(`  Control Plane buckets:\n`)
for (const [bucket, count] of Object.entries(bucketCounts)) {
  process.stdout.write(`    ${bucket}: ${count}\n`)
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
  process.exit(1)
} else {
  process.stdout.write('  ✓ Control plane coherence check passed\n\n')
}
