import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

const HEALTH_ROUTES = {
  web: join(ROOT, 'apps', 'web', 'app', 'api', 'health', 'route.ts'),
  console: join(ROOT, 'apps', 'console', 'app', 'api', 'health', 'route.ts'),
  'union-eyes': join(ROOT, 'apps', 'union-eyes', 'app', 'api', 'health', 'route.ts'),
} as const

function readContent(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

describe('Cross-app health consistency', () => {
  it('web, console, and union-eyes expose a health route', () => {
    for (const route of Object.values(HEALTH_ROUTES)) {
      expect(existsSync(route)).toBe(true)
    }
  })

  it('each health route returns a status and checks payload', () => {
    for (const [app, route] of Object.entries(HEALTH_ROUTES)) {
      const source = readContent(route)
      expect(source, `${app} health route should include status`).toMatch(/status/)
      expect(source, `${app} health route should include checks`).toMatch(/checks/)
      expect(source, `${app} health route should serialize JSON`).toMatch(/NextResponse\.json/)
    }
  })

  it('each health route exposes build metadata in a consistent way', () => {
    for (const [app, route] of Object.entries(HEALTH_ROUTES)) {
      const source = readContent(route)
      const hasBuildMetadata =
        source.includes('getBuildMetadata') || source.includes('buildInfo: { version: VERSION, commit: COMMIT }')
      expect(hasBuildMetadata, `${app} health route should expose build metadata`).toBe(true)
    }
  })

  it('console and union-eyes normalize health checks through os-core', () => {
    for (const app of ['console', 'union-eyes'] as const) {
      const source = readContent(HEALTH_ROUTES[app])
      expect(source, `${app} should normalize checks`).toContain('normalizeHealthChecks')
      expect(source, `${app} should derive status from checks`).toContain('healthStatusFromChecks')
    }
  })

  it('web remains contract-compatible with a timestamped public health payload', () => {
    const source = readContent(HEALTH_ROUTES.web)
    expect(source).toContain("status: 'ok'")
    expect(source).toContain('timestamp: new Date().toISOString()')
    expect(source).toContain('checks = { static: true }')
  })
})