/**
 * Phase 3 — Telemetry Enforcement (Manifest-Driven)
 *
 * For every product whose manifest sets `telemetryRequired: true`
 * (sourced from /platform/products/<slug>.json — i.e. flagship/growth tier),
 * verify the app ships the required telemetry surfaces:
 *
 *   - Error / performance monitoring (Sentry OR @nzila/os-core/telemetry initOtel/createAppBoot)
 *   - /api/health route (Next app-router OR Fastify routes/health.ts)
 *   - /api/metrics route OR metrics wiring in instrumentation/index
 *   - release version is exposed (NEXT_PUBLIC_RELEASE or package.json version)
 *
 * The set of apps under enforcement is intentionally driven by the canonical
 * platform manifest so adding/removing a flagship is a single-file change.
 *
 * Sentry is one valid error-monitoring transport; the workspace standard is
 * `@nzila/os-core/telemetry` (OTel → OTLP). Either satisfies the gate.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

interface TelemetryRequirements {
  generatedAt: string
  requiredApps: string[]
  exemptApps: string[]
}

function loadRequiredApps(): string[] {
  const p = join(ROOT, 'platform', 'products', '_telemetry-requirements.json')
  if (!existsSync(p)) {
    throw new Error(
      'Missing platform/products/_telemetry-requirements.json — run `pnpm tsx scripts/generate-platform-products.ts`',
    )
  }
  const data = JSON.parse(readFileSync(p, 'utf-8')) as TelemetryRequirements
  return data.requiredApps
}

function appRoot(slug: string): string {
  return join(ROOT, 'apps', slug)
}

function fileContains(path: string, needle: RegExp | string): boolean {
  if (!existsSync(path)) return false
  const content = readFileSync(path, 'utf-8')
  return typeof needle === 'string' ? content.includes(needle) : needle.test(content)
}

function dirHasFile(dir: string, name: string): boolean {
  if (!existsSync(dir)) return false
  return readdirSync(dir).includes(name)
}

function hasErrorMonitoring(slug: string): boolean {
  const root = appRoot(slug)
  // Sentry — Next.js convention
  if (existsSync(join(root, 'sentry.server.config.ts')) || existsSync(join(root, 'sentry.server.config.js'))) return true
  if (existsSync(join(root, 'sentry.edge.config.ts')) || existsSync(join(root, 'sentry.edge.config.js'))) return true
  // Sentry / OTel referenced from instrumentation.ts (Next.js apps)
  const instr = join(root, 'instrumentation.ts')
  if (fileContains(instr, /sentry|@sentry/i)) return true
  if (fileContains(instr, /(@nzila\/os-core\/telemetry|initOtel|createAppBoot)/)) return true
  // Fastify-style: src/index.ts boots OTel directly
  const srcIndex = join(root, 'src', 'index.ts')
  if (fileContains(srcIndex, /(@nzila\/os-core\/telemetry|initOtel|@sentry)/)) return true
  return false
}

function hasHealthRoute(slug: string): boolean {
  const root = appRoot(slug)
  const candidates = [
    // Next.js app-router
    join(root, 'app', 'api', 'health', 'route.ts'),
    join(root, 'app', 'api', 'healthz', 'route.ts'),
    join(root, 'app', '[locale]', 'api', 'health', 'route.ts'),
    join(root, 'app', '(api)', 'health', 'route.ts'),
    // Fastify-style apps
    join(root, 'src', 'routes', 'health.ts'),
    join(root, 'src', 'routes', 'health.js'),
    join(root, 'src', 'routes', 'healthz.ts'),
  ]
  return candidates.some((p) => existsSync(p))
}

function hasMetricsRoute(slug: string): boolean {
  const root = appRoot(slug)
  const candidates = [
    join(root, 'app', 'api', 'metrics', 'route.ts'),
    join(root, 'app', 'api', 'telemetry', 'route.ts'),
    join(root, 'app', '[locale]', 'api', 'metrics', 'route.ts'),
    join(root, 'src', 'routes', 'metrics.ts'),
    join(root, 'src', 'routes', 'metrics.js'),
  ]
  if (candidates.some((p) => existsSync(p))) return true
  // Fallback: instrumentation.ts that wires OTel/metrics is acceptable.
  return (
    fileContains(join(root, 'instrumentation.ts'), /(@nzila\/os-core\/telemetry|OTLPMetricExporter|prom-client|MetricExporter|initMetrics)/) ||
    fileContains(join(root, 'src', 'index.ts'), /(initMetrics|OTLPMetricExporter|prom-client)/)
  )
}

function hasReleaseVersion(slug: string): boolean {
  const root = appRoot(slug)
  const pkg = join(root, 'package.json')
  if (!existsSync(pkg)) return false
  const json = JSON.parse(readFileSync(pkg, 'utf-8')) as { version?: string }
  if (typeof json.version === 'string' && json.version.length > 0) return true
  return fileContains(join(root, '.env.example'), /(NEXT_PUBLIC_RELEASE|SENTRY_RELEASE)/)
}

describe('Phase 3 — Telemetry enforcement (manifest-driven)', () => {
  const required = loadRequiredApps()

  it('manifest declares at least one telemetry-required app', () => {
    expect(required.length).toBeGreaterThan(0)
  })

  for (const slug of required) {
    describe(`apps/${slug}`, () => {
      it('wires error / performance monitoring (Sentry or @nzila/os-core/telemetry)', () => {
        expect(
          hasErrorMonitoring(slug),
          `apps/${slug}: missing error monitoring.\n` +
            `Acceptable wirings: sentry.server.config.ts, instrumentation.ts referencing @sentry or @nzila/os-core/telemetry, ` +
            `or src/index.ts calling initOtel.\n` +
            `Either wire one of those, or set telemetryRequired:false in platform/products/envelope.config.json (and regenerate).`,
        ).toBe(true)
      })

      it('exposes a /api/health route (Next or Fastify)', () => {
        expect(
          hasHealthRoute(slug),
          `apps/${slug}: expected app/api/health/route.ts (Next) OR src/routes/health.ts (Fastify)`,
        ).toBe(true)
      })

      it('exposes a /api/metrics route or wires metrics in instrumentation', () => {
        expect(
          hasMetricsRoute(slug),
          `apps/${slug}: expected app/api/metrics/route.ts OR src/routes/metrics.ts OR instrumentation wiring (@nzila/os-core/telemetry, OTLP, prom-client)`,
        ).toBe(true)
      })

      it('declares a release version (package.json#version or NEXT_PUBLIC_RELEASE in .env.example)', () => {
        expect(hasReleaseVersion(slug), `apps/${slug}: missing release version surface`).toBe(true)
      })
    })
  }
})
