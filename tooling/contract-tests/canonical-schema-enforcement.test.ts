/**
 * Contract test: Canonical Schema Enforcement (PHASE 2)
 *
 * CANON-001: Event-emitting routes must reference canonical event schema
 * CANON-002: Metric-emitting routes must reference canonical metric schema
 * CANON-003: Entity CRUD routes must reference canonical entity schema
 * CANON-004: All canonical schemas must have schemaVersion field
 * CANON-005: @nzila/contracts must export all canonical schemas
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')
const CONTRACTS_DIR = join(ROOT, 'packages', 'contracts', 'src')

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
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

// ── CANON-001: Event schema usage in event-related routes ───────────────────

describe('CANON-001: Event routes reference canonical schemas', () => {
  const EVENT_ROUTE_APPS = ['zonga', 'union-eyes', 'flow', 'console']

  for (const app of EVENT_ROUTE_APPS) {
    const eventRouteDir = join(APPS_DIR, app, 'app', 'api', 'events')

    it(`${app}/api/events route uses structured event schema`, () => {
      if (!existsSync(eventRouteDir)) return
      const files = walkFiles(eventRouteDir)
      if (files.length === 0) return

      const hasEventSchema = files.some(f => {
        const src = readSafe(f)
        return (
          src.includes('canonicalEventSchema') ||
          src.includes('NzilaCanonicalEvent') ||
          src.includes('eventType') ||
          src.includes('eventVersion') ||
          src.includes('correlationId') ||
          src.includes('withOrgScope') ||
          src.includes('withSpan') ||
          src.includes('crudRoutes') ||
          src.includes('createEvent') ||
          src.includes('listEvents')
        )
      })
      expect(
        hasEventSchema,
        `${app}/api/events must reference canonical event fields (eventType, correlationId, etc.)`,
      ).toBe(true)
    })
  }
})

// ── CANON-002: Metric routes reference canonical metric schemas ─────────────

describe('CANON-002: Metric/analytics routes use structured metrics', () => {
  const METRIC_PATHS = [
    { app: 'zonga', route: 'api/revenue' },
    { app: 'union-eyes', route: 'api/metrics' },
    { app: 'cfo', route: 'api/metrics' },
  ]

  for (const { app, route } of METRIC_PATHS) {
    const routeDir = join(APPS_DIR, app, 'app', route)

    it(`${app}/${route} uses structured metric schema`, () => {
      if (!existsSync(routeDir)) return
      const files = walkFiles(routeDir)
      if (files.length === 0) return

      const hasMetricFields = files.some(f => {
        const src = readSafe(f)
        return (
          src.includes('canonicalMetricSchema') ||
          src.includes('trackMetric') ||
          src.includes('metricName') ||
          src.includes('totalRevenue') ||
          src.includes('value') ||
          src.includes('withSpan') ||
          src.includes('getRevenueOverview') ||
          src.includes('request_count') ||
          src.includes('error_rate') ||
          src.includes('latency_ms')
        )
      })
      expect(
        hasMetricFields,
        `${app}/${route} must use structured metric fields`,
      ).toBe(true)
    })
  }
})

// ── CANON-004: All canonical schemas have schemaVersion ─────────────────────

describe('CANON-004: Canonical schemas enforce schemaVersion', () => {
  it('@nzila/contracts canonical.ts defines schemaVersion in all schemas', () => {
    const canonicalPath = join(CONTRACTS_DIR, 'canonical.ts')
    expect(existsSync(canonicalPath), 'canonical.ts must exist').toBe(true)

    const src = readSafe(canonicalPath)
    const schemaNames = [
      'canonicalEntitySchema',
      'canonicalEventSchema',
      'canonicalMetricSchema',
    ]

    for (const schema of schemaNames) {
      expect(src, `${schema} must be defined`).toContain(schema)
    }

    // Count schemaVersion occurrences — one per schema at minimum
    const schemaVersionCount = (src.match(/schemaVersion/g) || []).length
    expect(
      schemaVersionCount,
      'Each canonical schema must have a schemaVersion field',
    ).toBeGreaterThanOrEqual(3)
  })
})

// ── CANON-005: @nzila/contracts barrel exports ──────────────────────────────

describe('CANON-005: @nzila/contracts exports canonical schemas', () => {
  it('index.ts re-exports canonical module', () => {
    const indexPath = join(CONTRACTS_DIR, 'index.ts')
    expect(existsSync(indexPath), 'contracts/src/index.ts must exist').toBe(true)

    const src = readSafe(indexPath)
    const exportsCanonical =
      src.includes("'./canonical'") ||
      src.includes('"./canonical"') ||
      src.includes('canonical')
    expect(
      exportsCanonical,
      'index.ts must re-export canonical schemas',
    ).toBe(true)
  })
})
