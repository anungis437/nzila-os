import { describe, expect, it } from 'vitest'
import { isApiRouteFile } from '../architecture-audit'

const OLD = /\/api\/.*route\.ts$/

describe('isApiRouteFile', () => {
  const samples = [
    'apps/x/app/api/foo/route.ts', 'apps/x/app/api/route.ts', '/api/route.ts', 'api/foo/route.ts',
    'apps/x/app/api/foo/route.tsx', 'apps/x/app/api/foo/myroute.ts', 'apps/x/app/foo/route.ts', 'route.ts',
    '/api/', '/api/oute.ts', 'a/api/b/api/c/route.ts', '/apiroute.ts', '/api/xroute.ts',
  ]
  it.each(samples)('matches previous behaviour for %j', (s) => {
    expect(isApiRouteFile(s)).toBe(OLD.test(s))
  })

  it('handles adversarial input quickly', () => {
    const t0 = Date.now()
    expect(isApiRouteFile('/api/'.repeat(50_000))).toBe(false)
    expect(Date.now() - t0).toBeLessThan(1000)
  })
})
