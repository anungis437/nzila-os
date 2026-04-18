/**
 * Agrimo — Platform Smoke Tests
 *
 * Validates the Agrimo app's platform integration:
 * proxy, health route, org resolution, instrumentation.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const APP = resolve(__dirname, '../..')

describe('Agrimo platform integration', () => {
  it('has proxy with rate limiting and request-ID', () => {
    const proxy = readFileSync(resolve(APP, 'proxy.ts'), 'utf-8')
    expect(proxy).toContain('export const proxy')
    expect(proxy).toContain('checkRateLimit')
    expect(proxy).toContain('x-request-id')
  })

  it('has health route', () => {
    expect(existsSync(resolve(APP, 'app/api/health/route.ts'))).toBe(true)
  })

  it('has org resolution', () => {
    expect(existsSync(resolve(APP, 'lib/resolve-org.ts'))).toBe(true)
  })

  it('has OTel instrumentation', () => {
    expect(existsSync(resolve(APP, 'instrumentation.ts'))).toBe(true)
  })

  it('depends on @nzila/os-core', () => {
    const pkg = JSON.parse(readFileSync(resolve(APP, 'package.json'), 'utf-8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(deps['@nzila/os-core']).toBeDefined()
  })
})
