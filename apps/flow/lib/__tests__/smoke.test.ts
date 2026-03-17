/**
 * Flow — Platform Smoke Tests
 *
 * Validates the Flow app's platform integration modules.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const APP = resolve(__dirname, '../..')

describe('Flow platform integration', () => {
  it('api-guards exports authenticateUser + withRequestContext', () => {
    const content = readFileSync(resolve(APP, 'lib/api-guards.ts'), 'utf-8')
    expect(content).toContain('authenticateUser')
    expect(content).toContain('withRequestContext')
  })

  it('has evidence pipeline', () => {
    const path = resolve(APP, 'lib/evidence.ts')
    expect(existsSync(path)).toBe(true)
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('buildQuoteEvidencePack')
  })

  it('has commerce telemetry wired', () => {
    const content = readFileSync(resolve(APP, 'lib/commerce-telemetry.ts'), 'utf-8')
    expect(content).toContain('logTransition')
    expect(content).toContain('@nzila/commerce-observability')
  })

  it('has AI + ML clients', () => {
    const ai = resolve(APP, 'lib/ai-client.ts')
    const ml = resolve(APP, 'lib/ml-client.ts')
    expect(existsSync(ai) || existsSync(resolve(APP, 'lib/ai/ai-client.ts'))).toBe(true)
    expect(existsSync(ml)).toBe(true)
  })

  it('has OTel instrumentation', () => {
    expect(existsSync(resolve(APP, 'instrumentation.ts'))).toBe(true)
  })
})
