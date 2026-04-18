/**
 * Trade — Platform Smoke Tests
 *
 * Validates the Trade app's platform integration:
 * proxy, health route, org resolution, and os-core dependency.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const APP = resolve(__dirname, '../..')

describe('Trade platform integration', () => {
  it('has proxy with rate limiting and request-ID', () => {
    const proxy = readFileSync(resolve(APP, 'proxy.ts'), 'utf-8')
    expect(proxy).toContain('export const proxy')
    expect(proxy).toContain('checkRateLimit')
    expect(proxy).toContain('x-request-id')
  })

  it('has health route at app/api/health/route.ts', () => {
    expect(existsSync(resolve(APP, 'app/api/health/route.ts'))).toBe(true)
    const content = readFileSync(resolve(APP, 'app/api/health/route.ts'), 'utf-8')
    expect(content).toContain('checkDb')
    expect(content).toContain('degraded')
  })

  it('has org resolution', () => {
    const path = resolve(APP, 'lib/resolve-org.ts')
    expect(existsSync(path)).toBe(true)
  })

  it('depends on @nzila/os-core', () => {
    const pkg = JSON.parse(readFileSync(resolve(APP, 'package.json'), 'utf-8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(deps['@nzila/os-core']).toBeDefined()
  })
})
