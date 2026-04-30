/**
 * Phase 3 — Telemetry Enforcement (Manifest-Driven)
 */
/* eslint-disable security/detect-non-literal-fs-filename */
/**
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
import { existsSync } from 'node:fs'

import { ROOT as REPO_ROOT, safeJoin, readContent } from './governance-helpers'

const ROOT = REPO_ROOT

function mustJoin(base: string, ...parts: string[]): string {
  const path = safeJoin(base, ...parts)
  if (!path) throw new Error(`Invalid path under ${base}: ${parts.join('/')}`)
  return path
}

interface TelemetryRequirements {
  generatedAt: string
  requiredApps: string[]
  exemptApps: string[]
}

function loadRequiredApps(): string[] {
  const filePath = mustJoin(ROOT, 'platform', 'products', '_telemetry-requirements.json')
  const content = readContent(filePath)
  if (!content) {
    throw new Error(
      'Missing platform/products/_telemetry-requirements.json — run `pnpm tsx scripts/generate-platform-products.ts`',
    )
  }
  const data = JSON.parse(content) as TelemetryRequirements
  return data.requiredApps
}

function appRoot(slug: string): string {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`Invalid app slug: ${slug}`)
  }
  return mustJoin(ROOT, 'apps', slug)
}

function fileContains(path: string, needle: RegExp | string): boolean {
  const content = readContent(path)
  if (!content) return false
  return typeof needle === 'string' ? content.includes(needle) : needle.test(content)
}

function hasErrorMonitoring(slug: string): boolean {
  const root = appRoot(slug)
  // Sentry — Next.js convention
  if (existsSync(mustJoin(root, 'sentry.server.config.ts')) || existsSync(mustJoin(root, 'sentry.server.config.js'))) return true
  if (existsSync(mustJoin(root, 'sentry.edge.config.ts')) || existsSync(mustJoin(root, 'sentry.edge.config.js'))) return true
  // Sentry / OTel referenced from instrumentation.ts (Next.js apps)
  const instr = mustJoin(root, 'instrumentation.ts')
  if (fileContains(instr, /sentry|@sentry/i)) return true
  if (fileContains(instr, /(@nzila\/os-core\/telemetry|initOtel|createAppBoot)/)) return true
  // Fastify-style: src/index.ts boots OTel directly
  const srcIndex = mustJoin(root, 'src', 'index.ts')
  if (fileContains(srcIndex, /(@nzila\/os-core\/telemetry|initOtel|@sentry)/)) return true
  return false
}

function hasHealthRoute(slug: string): boolean {
  const root = appRoot(slug)
  const candidates = [
    // Next.js app-router
    mustJoin(root, 'app', 'api', 'health', 'route.ts'),
    mustJoin(root, 'app', 'api', 'healthz', 'route.ts'),
    mustJoin(root, 'app', '[locale]', 'api', 'health', 'route.ts'),
    mustJoin(root, 'app', '(api)', 'health', 'route.ts'),
    // Fastify-style apps
    mustJoin(root, 'src', 'routes', 'health.ts'),
    mustJoin(root, 'src', 'routes', 'health.js'),
    mustJoin(root, 'src', 'routes', 'healthz.ts'),
  ]
  return candidates.some((path) => existsSync(path))
}

function hasMetricsRoute(slug: string): boolean {
  const root = appRoot(slug)
  const candidates = [
    mustJoin(root, 'app', 'api', 'metrics', 'route.ts'),
    mustJoin(root, 'app', 'api', 'telemetry', 'route.ts'),
    mustJoin(root, 'app', '[locale]', 'api', 'metrics', 'route.ts'),
    mustJoin(root, 'src', 'routes', 'metrics.ts'),
    mustJoin(root, 'src', 'routes', 'metrics.js'),
  ]
  if (candidates.some((path) => existsSync(path))) return true
  // Fallback: instrumentation.ts that wires OTel/metrics is acceptable.
  return (
    fileContains(mustJoin(root, 'instrumentation.ts'), /(@nzila\/os-core\/telemetry|OTLPMetricExporter|prom-client|MetricExporter|initMetrics)/) ||
    fileContains(mustJoin(root, 'src', 'index.ts'), /(initMetrics|OTLPMetricExporter|prom-client)/)
  )
}

function hasReleaseVersion(slug: string): boolean {
  const root = appRoot(slug)
  const pkg = mustJoin(root, 'package.json')
  const content = readContent(pkg)
  if (!content) return false
  const json = JSON.parse(content) as { version?: string }
  if (typeof json.version === 'string' && json.version.length > 0) return true
  return fileContains(mustJoin(root, '.env.example'), /(NEXT_PUBLIC_RELEASE|SENTRY_RELEASE)/)
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
