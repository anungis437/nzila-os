import { describe, expect, it } from 'vitest'
import { providerCatalog, requiredSecretsForProvider } from '../integrations-provider-catalog'

describe('integrations provider catalog', () => {
  it('keeps HubSpot required secret as apiKey', () => {
    expect(requiredSecretsForProvider('hubspot')).toEqual(['apiKey'])
    expect(providerCatalog.hubspot.requiredSecrets).toEqual(['apiKey'])
  })

  it('returns explicit validation error when HubSpot apiKey is missing', async () => {
    const result = await providerCatalog.hubspot.testConnection({})

    expect(result.ok).toBe(false)
    expect(result.error).toContain('apiKey')
  })
})
