import { afterEach, describe, expect, it } from 'vitest'
import { isDeployedRuntime, isLocalQaRuntime, isProductionDeployment } from './runtime-identity'
import { decryptSecret, encryptSecret } from './mfa/encryption'

const KEY_A = 'a'.repeat(64)
const KEY_B = 'b'.repeat(64)

const touched = ['NODE_ENV', 'UE_ENVIRONMENT', 'NEXT_PUBLIC_APP_ENV', 'TARGET_ENVIRONMENT', 'NZILA_MODE', 'QA_TEST_ENV', 'AUTH_SECRET', 'AUTH_MFA_ENCRYPTION_KEY']
const saved = Object.fromEntries(touched.map((name) => [name, process.env[name]]))

function setEnv(values: Record<string, string | undefined>): void {
  for (const name of touched) delete process.env[name]
  for (const [name, value] of Object.entries(values)) if (value !== undefined) process.env[name] = value
}

afterEach(() => {
  for (const name of touched) {
    if (saved[name] === undefined) delete process.env[name]
    else process.env[name] = saved[name]
  }
})

describe('runtime identity', () => {
  it('reads production from any identity the deployment states', () => {
    expect(isProductionDeployment({ UE_ENVIRONMENT: 'production' })).toBe(true)
    expect(isProductionDeployment({ UE_ENVIRONMENT: 'staging', NEXT_PUBLIC_APP_ENV: 'production' })).toBe(true)
    expect(isProductionDeployment({ NODE_ENV: 'production' })).toBe(true)
    expect(isProductionDeployment({ NODE_ENV: 'production', UE_ENVIRONMENT: 'staging' })).toBe(false)
  })

  it('treats a production build, or any named deployment, as a deployed runtime', () => {
    expect(isDeployedRuntime({ NODE_ENV: 'production', UE_ENVIRONMENT: 'local' })).toBe(true)
    expect(isDeployedRuntime({ NODE_ENV: 'development', UE_ENVIRONMENT: 'staging' })).toBe(true)
    expect(isDeployedRuntime({ NODE_ENV: 'development', UE_ENVIRONMENT: 'local' })).toBe(false)
  })

  it('opens the QA harness only for QA_TEST_ENV=true with an explicit local identity and no deployment signal', () => {
    expect(isLocalQaRuntime({ QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'local' })).toBe(true)
    expect(isLocalQaRuntime({ QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'local', NODE_ENV: 'production' })).toBe(true)
    expect(isLocalQaRuntime({ QA_TEST_ENV: 'true' })).toBe(false)
    expect(isLocalQaRuntime({ QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'production' })).toBe(false)
    expect(isLocalQaRuntime({ QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'local', NEXT_PUBLIC_APP_ENV: 'production' })).toBe(false)
    expect(isLocalQaRuntime({ QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'local', NZILA_MODE: 'pilot' })).toBe(false)
    expect(isLocalQaRuntime({ QA_TEST_ENV: 'false', UE_ENVIRONMENT: 'local' })).toBe(false)
  })
})

describe('MFA secret encryption key', () => {
  it('refuses to encrypt a new secret in a deployed environment without AUTH_MFA_ENCRYPTION_KEY, even with AUTH_SECRET set', () => {
    for (const identity of [{ UE_ENVIRONMENT: 'production' }, { UE_ENVIRONMENT: 'staging' }, { NODE_ENV: 'production' }]) {
      setEnv({ ...identity, AUTH_SECRET: 'x'.repeat(40) })
      expect(() => encryptSecret('JBSWY3DPEHPK3PXP')).toThrow(/AUTH_MFA_ENCRYPTION_KEY is required in a deployed environment/)
    }
  })

  it('encrypts and decrypts under the explicit key in a deployed environment', () => {
    setEnv({ UE_ENVIRONMENT: 'production', AUTH_MFA_ENCRYPTION_KEY: KEY_A })
    expect(decryptSecret(encryptSecret('JBSWY3DPEHPK3PXP'))).toBe('JBSWY3DPEHPK3PXP')
  })

  it('rejects a malformed explicit key', () => {
    setEnv({ UE_ENVIRONMENT: 'production', AUTH_MFA_ENCRYPTION_KEY: 'not-hex' })
    expect(() => encryptSecret('secret')).toThrow(/64 hex characters/)
  })

  it('keeps a secret stored under the derived key readable once the explicit key is set, and writes new ones under the explicit key only', () => {
    setEnv({ UE_ENVIRONMENT: 'local', NODE_ENV: 'development', AUTH_SECRET: 'x'.repeat(40) })
    const legacy = encryptSecret('LEGACYSECRET')

    setEnv({ UE_ENVIRONMENT: 'production', AUTH_SECRET: 'x'.repeat(40), AUTH_MFA_ENCRYPTION_KEY: KEY_A })
    expect(decryptSecret(legacy)).toBe('LEGACYSECRET')
    const fresh = encryptSecret('FRESHSECRET')

    setEnv({ UE_ENVIRONMENT: 'production', AUTH_SECRET: 'y'.repeat(40), AUTH_MFA_ENCRYPTION_KEY: KEY_B })
    expect(() => decryptSecret(fresh)).toThrow()
  })

  it('still derives the key from AUTH_SECRET on a developer machine', () => {
    setEnv({ UE_ENVIRONMENT: 'local', NODE_ENV: 'development', AUTH_SECRET: 'x'.repeat(40) })
    expect(decryptSecret(encryptSecret('DEVSECRET'))).toBe('DEVSECRET')
  })
})
