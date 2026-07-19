import { afterEach, describe, expect, it } from 'vitest'
import { providerKeys, requiredSecretsForProvider } from '../integrations-provider-catalog'
import {
  envVarForProviderSecret,
  getAllProviderEnvReadiness,
  getProviderEnvReadiness,
} from '../integrations-env-readiness'

describe('integrations env readiness', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('maps every required provider secret to a non-empty env var name', () => {
    for (const provider of providerKeys) {
      const required = requiredSecretsForProvider(provider)
      for (const secret of required) {
        const envName = envVarForProviderSecret(provider, secret)
        expect(envName.length).toBeGreaterThan(0)
      }
    }
  })

  it('reports missing env vars for unconfigured provider', () => {
    delete process.env.SENDGRID_API_KEY
    delete process.env.SENDGRID_FROM_ADDRESS

    const result = getProviderEnvReadiness('sendgrid')
    expect(result.configured).toBe(false)
    expect(result.missingEnvVars).toEqual(['SENDGRID_API_KEY', 'SENDGRID_FROM_ADDRESS'])
  })

  it('reports configured=true when all required vars are present', () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/abc'

    const result = getProviderEnvReadiness('slack')
    expect(result.configured).toBe(true)
    expect(result.missingEnvVars).toEqual([])
  })

  it('returns readiness for every provider in catalog', () => {
    const all = getAllProviderEnvReadiness()
    expect(all).toHaveLength(providerKeys.length)
    expect(new Set(all.map((row) => row.provider)).size).toBe(providerKeys.length)
  })
})
