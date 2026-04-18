/**
 * Platform Admin — Platform Smoke Tests
 *
 * Validates the Platform Admin app's platform integration:
 * proxy, health route, os-core dependency.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const APP = resolve(__dirname, '../..')

describe('Platform Admin platform integration', () => {
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

  it('depends on @nzila/os-core', () => {
    const pkg = JSON.parse(readFileSync(resolve(APP, 'package.json'), 'utf-8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(deps['@nzila/os-core']).toBeDefined()
  })

  it('depends on @nzila/platform-auth for auth', () => {
    const pkg = JSON.parse(readFileSync(resolve(APP, 'package.json'), 'utf-8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(deps['@nzila/platform-auth']).toBeDefined()
  })
})
