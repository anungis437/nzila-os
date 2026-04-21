/**
 * Phase 3 — Telemetry Enforcement (Manifest-Driven)
 *
 * For every product whose manifest sets `telemetryRequired: true`
 * (sourced from /platform/products/<slug>.json — i.e. flagship/growth tier),
 * verify the app ships the required telemetry surfaces:
 *
 *   - Sentry config (sentry.server.config.ts OR instrumentation.ts referencing Sentry)
 *   - /api/health route
 *   - /api/metrics route OR @nzila/os-core telemetry usage in instrumentation
 *   - release version is exposed (NEXT_PUBLIC_RELEASE or package.json version)
 *
 * The set of apps under enforcement is intentionally driven by the canonical
 * platform manifest so adding/removing a flagship is a single-file change.
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

function hasSentry(slug: string): boolean {
  const root = appRoot(slug)
  if (existsSync(join(root, 'sentry.server.config.ts')) || existsSync(join(root, 'sentry.server.config.js'))) return true
  if (existsSync(join(root, 'sentry.edge.config.ts')) || existsSync(join(root, 'sentry.edge.config.js'))) return true
  if (fileContains(join(root, 'instrumentation.ts'), /sentry|@sentry/i)) return true
  return false
}

function hasHealthRoute(slug: string): boolean {
  const root = appRoot(slug)
  // Next.js app-router: app/api/health/route.ts or app/[locale]/api/health/route.ts
  const candidates = [
    join(root, 'app', 'api', 'health', 'route.ts'),
    join(root, 'app', 'api', 'healthz', 'route.ts'),
    join(root, 'app', '[locale]', 'api', 'health', 'route.ts'),
    join(root, 'app', '(api)', 'health', 'route.ts'),
  ]
  return candidates.some((p) => existsSync(p))
}

function hasMetricsRoute(slug: string): boolean {
  const root = appRoot(slug)
  const candidates = [
    join(root, 'app', 'api', 'metrics', 'route.ts'),
    join(root, 'app', 'api', 'telemetry', 'route.ts'),
    join(root, 'app', '[locale]', 'api', 'metrics', 'route.ts'),
  ]
  if (candidates.some((p) => existsSync(p))) return true
  // Fallback: instrumentation.ts that exports OTel/metrics setup is acceptable.
  return fileContains(join(root, 'instrumentation.ts'), /(@nzila\/os-core\/telemetry|OTLPMetricExporter|prom-client|MetricExporter)/)
}

function hasReleaseVersion(slug: string): boolean {
  const root = appRoot(slug)
  const pkg = join(root, 'package.json')
  if (!existsSync(pkg)) return false
  const json = JSON.parse(readFileSync(pkg, 'utf-8')) as { version?: string }
  if (typeof json.version === 'string' && json.version.length > 0) return true
  // Or if .env.example declares NEXT_PUBLIC_RELEASE / SENTRY_RELEASE
  return fileContains(join(root, '.env.example'), /(NEXT_PUBLIC_RELEASE|SENTRY_RELEASE)/)
}

describe('Phase 3 — Telemetry enforcement (manifest-driven)', () => {
  const required = loadRequiredApps()

  it('manifest declares at least one telemetry-required app', () => {
    expect(required.length).toBeGreaterThan(0)
  })

  for (const slug of required) {
    describe(`apps/${slug}`, () => {
      it('declares Sentry config (sentry.server.config or instrumentation references @sentry)', () => {
        expect(
          hasSentry(slug),
          `apps/${slug}: missing Sentry config (sentry.server.config.ts | sentry.edge.config.ts | instrumentation.ts referencing @sentry).\n` +
            `Either wire Sentry, or set telemetryRequired:false in platform/products/envelope.config.json (and regenerate).`,
        ).toBe(true)
      })

      it('exposes a /api/health route', () => {
        expect(hasHealthRoute(slug), `apps/${slug}: expected app/api/health/route.ts (or [locale] variant)`).toBe(true)
      })

      it('exposes a /api/metrics route or wires metrics in instrumentation.ts', () => {
        expect(
          hasMetricsRoute(slug),
          `apps/${slug}: expected app/api/metrics/route.ts OR instrumentation.ts wiring (@nzila/os-core/telemetry, OTLP, or prom-client)`,
        ).toBe(true)
      })

      it('declares a release version (package.json#version or NEXT_PUBLIC_RELEASE in .env.example)', () => {
        expect(hasReleaseVersion(slug), `apps/${slug}: missing release version surface`).toBe(true)
      })
    })
  }
})
