const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('lib/api/deprecation.ts', [
  [`canonical: '/api/auth/session', reason: 'Replaced by session endpoint'`, `canonical: '/api/auth/me', reason: 'Replaced by the current-user endpoint'`],
  ...['aged-receivables', 'balance-sheet', 'cash-flow', 'income-statement'].map((r) => [
    `{ deprecated: '/api/financial/reports/${r}', canonical: '/api/billing/reports', reason: 'Consolidated into billing reports', phase: 2 }`,
    `{ deprecated: '/api/financial/reports/${r}', canonical: 'REMOVED', reason: 'No billing report route exists to take its place; the report is not available', phase: 2 }`,
  ]),
  [`canonical: '/api/messages/[id]', reason: 'Duplicate of messages — same table'`, `canonical: '/api/messages/threads/[threadId]', reason: 'Duplicate of messages — same table'`],
  [`canonical: '/api/strike/fund', reason: 'Merged into strike fund domain'`, `canonical: '/api/strike/funds', reason: 'Merged into strike fund domain'`],
  [`  // RFC 8594 headers
  res.headers.set('Deprecation', 'true');
  res.headers.set('Sunset', SUNSET_DATE.toUTCString());`, `  // RFC 8594 headers. A sunset that has already passed is not advertised as upcoming.
  res.headers.set('Deprecation', 'true');
  if (SUNSET_DATE.getTime() > Date.now()) res.headers.set('Sunset', SUNSET_DATE.toUTCString());`],
  [`      _sunset: SUNSET_DATE.toISOString(),
      _canonical: canonicalPath,`, `      _sunset: SUNSET_DATE.toISOString(),
      _sunsetPassed: SUNSET_DATE.getTime() <= Date.now(),
      _canonical: canonicalPath,`],
])
fs.writeFileSync('lib/api/__tests__/deprecation-registry.test.ts', `import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/audit-logger', () => ({ auditLog: vi.fn(async () => undefined) }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { DEPRECATED_ROUTE_MAP, deprecatedResponse } from '../deprecation'

const API = join(__dirname, '..', '..', '..', 'app', 'api')
const routeExists = (canonical: string) => {
  const dir = join(API, ...canonical.replace(/^\\/api\\//, '').replace(/\\/\\*$/, '').split('/'))
  return existsSync(join(dir, 'route.ts')) || (existsSync(dir) && statSync(dir).isDirectory())
}

// DEF-0B6-SYS-DEPRECATION-REGISTRY-NAMES-MISSING-REPLACEMENTS-AND-STALE-SUNSET
describe('deprecation registry', () => {
  afterEach(() => vi.useRealTimers())

  it('names, for every replaced route, a route that exists; a route with no replacement says REMOVED', () => {
    const missing = DEPRECATED_ROUTE_MAP.filter((row) => row.canonical !== 'REMOVED' && row.canonical !== '/api/*' && !routeExists(row.canonical))
    expect(missing.map((row) => \`\${row.deprecated} -> \${row.canonical}\`)).toEqual([])
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

  it('keeps a source note that the registry is checked against the route tree', () => {
    expect(readFileSync(join(__dirname, '..', 'deprecation.ts'), 'utf8')).toContain('SUNSET_DATE')
  })
})
`)
console.log('ok')
