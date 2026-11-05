/**
 * The production guard (UE-CONV-H-024): what a process is, and what a development or test escape hatch may do there.
 *
 * Every case runs against the TypeScript module and its `.mjs` mirror, so the scripts that cannot import TypeScript are held to the same answers.
 */
import { describe, expect, it, vi } from 'vitest'
import * as ts from '../production-guard'
// @ts-expect-error the mirror is plain JavaScript
import * as mjs from '../production-guard.mjs'

const guards = [
  ['production-guard.ts', ts],
  ['production-guard.mjs', mjs],
] as const

describe.each(guards)('%s', (_name, guard) => {
  it('is a production deployment when any identity says production, whatever the others say', () => {
    for (const env of [{ UE_ENVIRONMENT: 'production' }, { UE_ENVIRONMENT: 'prod' }, { NEXT_PUBLIC_APP_ENV: 'production' }, { TARGET_ENVIRONMENT: 'production' }, { NZILA_MODE: 'production' }, { UE_ENVIRONMENT: 'development', NEXT_PUBLIC_APP_ENV: 'production' }, { UE_ENVIRONMENT: 'staging', NODE_ENV: 'production', TARGET_ENVIRONMENT: 'prod' }]) {
      expect(guard.isProductionDeployment(env), JSON.stringify(env)).toBe(true)
    }
  })

  it('treats a container that runs production code and names no identity as production, and names a staging or pilot deployment as not production', () => {
    expect(guard.isProductionDeployment({ NODE_ENV: 'production' })).toBe(true)
    expect(guard.isProductionDeployment({ NODE_ENV: 'production NEXT_PUBLIC_APP_ENV=staging' })).toBe(true)
    expect(guard.isProductionDeployment({ NODE_ENV: 'production', UE_ENVIRONMENT: 'staging', NEXT_PUBLIC_APP_ENV: 'staging', NZILA_MODE: 'staging' })).toBe(false)
    expect(guard.isProductionDeployment({ NODE_ENV: 'production', UE_ENVIRONMENT: 'pilot' })).toBe(false)
    expect(guard.isProductionDeployment({ NODE_ENV: 'development' })).toBe(false)
    expect(guard.isProductionDeployment({})).toBe(false)
  })

  it('is a deployed runtime for NODE_ENV=production or any deployed identity, so labelling a production container development does not open a hatch', () => {
    for (const env of [{ NODE_ENV: 'production' }, { NODE_ENV: 'production', UE_ENVIRONMENT: 'development' }, { UE_ENVIRONMENT: 'staging' }, { UE_ENVIRONMENT: 'pilot' }, { NEXT_PUBLIC_APP_ENV: 'demo' }, { UE_ENVIRONMENT: 'prod' }]) {
      expect(guard.isDeployedRuntime(env), JSON.stringify(env)).toBe(true)
    }
    for (const env of [{}, { NODE_ENV: 'development' }, { NODE_ENV: 'test' }, { UE_ENVIRONMENT: 'local' }, { UE_ENVIRONMENT: 'dev' }]) {
      expect(guard.isDeployedRuntime(env), JSON.stringify(env)).toBe(false)
    }
  })

  it('switches an escape hatch on only outside a deployment', () => {
    expect(guard.escapeHatchActive('HATCH', { HATCH: 'true', NODE_ENV: 'development' })).toBe(true)
    expect(guard.escapeHatchActive('HATCH', { HATCH: '1' })).toBe(true)
    expect(guard.escapeHatchActive('HATCH', { HATCH: 'false', NODE_ENV: 'development' })).toBe(false)
    expect(guard.escapeHatchActive('HATCH', { NODE_ENV: 'development' })).toBe(false)
    expect(guard.escapeHatchActive('HATCH', { HATCH: 'true', NODE_ENV: 'production' })).toBe(false)
    expect(guard.escapeHatchActive('HATCH', { HATCH: 'true', NODE_ENV: 'production', UE_ENVIRONMENT: 'development' })).toBe(false)
    expect(guard.escapeHatchActive('HATCH', { HATCH: 'true', UE_ENVIRONMENT: 'staging' })).toBe(false)
  })

  it('refuses a seed script against production with no override', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      expect(() => guard.assertNotProduction('seed-demo', { UE_ENVIRONMENT: 'production' })).toThrow(/Refusing to run "seed-demo"/)
      // The override this guard used to honour is gone: setting it changes nothing.
      expect(() => guard.assertNotProduction('seed-demo', { UE_ENVIRONMENT: 'production', ALLOW_PRODUCTION_SEED: '1' })).toThrow(/no override/)
      expect(() => guard.assertNotProduction('seed-demo', { NODE_ENV: 'production' })).toThrow(/Refusing/)
      expect(() => guard.assertNotProduction('seed-demo', { NODE_ENV: 'production', UE_ENVIRONMENT: 'staging' })).not.toThrow()
      expect(() => guard.assertNotProduction('seed-demo', { NODE_ENV: 'development' })).not.toThrow()
    } finally {
      write.mockRestore()
    }
  })

  it('resolves the identity in the order the deployment states it', () => {
    expect(guard.resolveEnvironment({ UE_ENVIRONMENT: ' Staging ', NEXT_PUBLIC_APP_ENV: 'production', NODE_ENV: 'production' })).toEqual({ environment: 'staging', source: 'UE_ENVIRONMENT' })
    expect(guard.resolveEnvironment({ NEXT_PUBLIC_APP_ENV: 'pilot', NODE_ENV: 'production' })).toEqual({ environment: 'pilot', source: 'NEXT_PUBLIC_APP_ENV' })
    expect(guard.resolveEnvironment({ NODE_ENV: 'production NEXT_PUBLIC_APP_ENV=staging' })).toEqual({ environment: 'production', source: 'NODE_ENV' })
    expect(guard.resolveEnvironment({})).toEqual({ environment: '', source: 'unset' })
  })
})
