import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/audit-logger', () => ({ auditLog: vi.fn(async () => undefined) }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { DEPRECATED_ROUTE_MAP, deprecatedResponse } from '../deprecation'

const API = join(__dirname, '..', '..', '..', 'app', 'api')
const routeExists = (canonical: string) => {
  const dir = join(API, ...canonical.replace(/^\/api\//, '').replace(/\/\*$/, '').split('/'))
  return existsSync(join(dir, 'route.ts')) || (existsSync(dir) && statSync(dir).isDirectory())
}

// DEF-0B6-SYS-DEPRECATION-REGISTRY-NAMES-MISSING-REPLACEMENTS-AND-STALE-SUNSET
describe('deprecation registry', () => {
  afterEach(() => vi.useRealTimers())

  it('names, for every replaced route, a route that exists; a route with no replacement says REMOVED', () => {
    const missing = DEPRECATED_ROUTE_MAP.filter((row) => row.canonical !== 'REMOVED' && row.canonical !== '/api/*' && !routeExists(row.canonical))
    expect(missing.map((row) => `${row.deprecated} -> ${row.canonical}`)).toEqual([])
  })

  it('does not advertise a Sunset header once the sunset date has passed, and says so in the body', async () => {
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
    const response = deprecatedResponse('/api/v2/x', '/api/x')
    expect(response.headers.get('Sunset')).toBeNull()
    expect(response.headers.get('Deprecation')).toBe('true')
    expect((await response.json())._sunsetPassed).toBe(true)
  })

  it('advertises the Sunset header while the date is still ahead', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    expect(deprecatedResponse('/api/v2/x', '/api/x').headers.get('Sunset')).toContain('2026')
  })
})
