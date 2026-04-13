/**
 * API Versioning Contract Test
 *
 * Enforces that apps exposing API routes adopt a versioning strategy.
 * Union-Eyes already has /api/v2/ routes — other apps should follow.
 *
 * @invariant API_VERSION_001 — API routes should use versioned prefixes (/api/v1/, /api/v2/)
 * @invariant API_VERSION_002 — No mixed versioning schemes within a single app
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  ROOT,
  relPath,
  formatViolations,
  type Violation,
} from './governance-helpers'

/** Apps known to expose API routes */
const API_APPS = [
  'union-eyes',
  'console',
  'web',
  'partners',
  'zonga',
  'agrimo',
  'cfo',
  'trade',
  'orchestrator-api',
]

/** Apps that already have versioned routes (known-good) */
const VERSIONED_APPS = new Set(['union-eyes'])

/** Apps exempt from versioning requirement (internal-only, no public API) */
const EXEMPT_APPS = new Set([
  'control-plane',
  'platform-admin',
  'mobility',
  'mobility-client-portal',
  'nacp-exams',
  'cora',
  'abr',
  'flow',
])

function hasApiRoutes(appDir: string): boolean {
  const apiDir = join(appDir, 'app', 'api')
  return existsSync(apiDir)
}

function hasVersionedRoutes(appDir: string): boolean {
  const apiDir = join(appDir, 'app', 'api')
  if (!existsSync(apiDir)) return false
  try {
    const entries = readdirSync(apiDir, { withFileTypes: true })
    return entries.some(
      (e) => e.isDirectory() && /^v\d+$/.test(e.name),
    )
  } catch {
    return false
  }
}

describe('API_VERSION_001 — API apps should adopt versioned routes', () => {
  it('should have versioned API route directories (/api/v1/ or /api/v2/)', () => {
    const violations: Violation[] = []

    for (const app of API_APPS) {
      if (EXEMPT_APPS.has(app)) continue
      const appDir = join(ROOT, 'apps', app)
      if (!existsSync(appDir)) continue

      if (hasApiRoutes(appDir) && !hasVersionedRoutes(appDir)) {
        violations.push({
          ruleId: 'API_VERSION_001',
          filePath: `apps/${app}/app/api/`,
          remediation: `Add versioned route prefix (e.g., /api/v1/) for public-facing API routes`,
        })
      }
    }

    // Warn but don't fail — this is an adoption gate, not a blocker
    if (violations.length > 0) {
      const versioned = API_APPS.filter(
        (a) => !EXEMPT_APPS.has(a) && hasVersionedRoutes(join(ROOT, 'apps', a)),
      )
      const total = API_APPS.filter((a) => !EXEMPT_APPS.has(a)).length
      console.warn(
        `API versioning adoption: ${versioned.length}/${total} apps\n` +
          formatViolations(violations),
      )
    }

    // Assert that known-versioned apps haven't regressed
    for (const app of VERSIONED_APPS) {
      const appDir = join(ROOT, 'apps', app)
      if (!existsSync(appDir)) continue
      expect(
        hasVersionedRoutes(appDir),
        `${app} must maintain versioned API routes`,
      ).toBe(true)
    }
  })
})

describe('API_VERSION_002 — Consistent versioning within apps', () => {
  it('versioned apps should not have unversioned mutation routes alongside versioned ones', () => {
    const violations: Violation[] = []

    for (const app of VERSIONED_APPS) {
      const apiDir = join(ROOT, 'apps', app, 'app', 'api')
      if (!existsSync(apiDir)) continue

      try {
        const entries = readdirSync(apiDir, { withFileTypes: true })
        const versionedDirs = entries.filter(
          (e) => e.isDirectory() && /^v\d+$/.test(e.name),
        )
        const unversionedDirs = entries.filter(
          (e) =>
            e.isDirectory() &&
            !/^v\d+$/.test(e.name) &&
            // Allow status/health/webhook routes to be unversioned
            !['health', 'status', 'webhooks', 'auth', 'trpc', 'auth_core', 'admin', 'uploadthing'].includes(
              e.name,
            ),
        )

        if (versionedDirs.length > 0 && unversionedDirs.length > 0) {
          for (const dir of unversionedDirs) {
            violations.push({
              ruleId: 'API_VERSION_002',
              filePath: relPath(join(apiDir, dir.name)),
              offendingValue: dir.name,
              remediation: `Move under /api/v1/ or /api/v2/ for consistency`,
            })
          }
        }
      } catch {
        // Skip unreadable dirs
      }
    }

    // This is advisory — log but don't fail during migration
    if (violations.length > 0) {
      console.warn(
        `Mixed versioning detected:\n${formatViolations(violations)}`,
      )
    }
  })
})
