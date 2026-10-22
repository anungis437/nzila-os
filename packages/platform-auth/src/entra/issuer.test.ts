import { describe, expect, it } from 'vitest'
import { resolveEntraIssuer } from './issuer'

const tenantId = '50820000-0000-0000-0000-000000000001'
const common = 'https://login.microsoftonline.com/common/v2.0'

describe('Entra staging single-tenant issuer', () => {
  it.each([undefined, '', 'false'])('preserves default multi-tenant issuer for opt-in %s', (optIn) => {
    for (const environment of [undefined, 'staging', 'production', 'development']) {
      expect(resolveEntraIssuer({
        AZURE_AD_STAGING_SINGLE_TENANT: optIn,
        TARGET_ENVIRONMENT: environment,
        AZURE_AD_TENANT_ID: tenantId,
      })).toBe(common)
    }
  })

  it('uses the exact tenant issuer only with explicit staging opt-in', () => {
    expect(resolveEntraIssuer({
      AZURE_AD_STAGING_SINGLE_TENANT: 'true', TARGET_ENVIRONMENT: 'staging',
      AZURE_AD_TENANT_ID: tenantId.toUpperCase(),
    })).toBe(`https://login.microsoftonline.com/${tenantId}/v2.0`)
  })

  it.each([undefined, 'production', 'development', 'Staging', 'staging '])(
    'rejects staging opt-in outside exact staging environment: %s', (environment) => {
      expect(() => resolveEntraIssuer({
        AZURE_AD_STAGING_SINGLE_TENANT: 'true', TARGET_ENVIRONMENT: environment,
        AZURE_AD_TENANT_ID: tenantId,
      })).toThrow('TARGET_ENVIRONMENT=staging')
    },
  )

  it.each([undefined, '', 'common', 'organizations', 'consumers', 'https://evil.example',
    `${tenantId}/../common`, ` ${tenantId}`, tenantId + String.fromCharCode(10),
    tenantId + String.fromCharCode(13), '00000000-0000-0000-0000-000000000000'])(
    'fails closed for invalid or absent tenant %s', (tenant) => {
      expect(() => resolveEntraIssuer({
        AZURE_AD_STAGING_SINGLE_TENANT: 'true', TARGET_ENVIRONMENT: 'staging',
        AZURE_AD_TENANT_ID: tenant,
      })).toThrow('AZURE_AD_TENANT_ID GUID')
    },
  )

  it.each(['TRUE', '1', 'yes', ' true '])('rejects ambiguous opt-in %s', (optIn) => {
    expect(() => resolveEntraIssuer({ AZURE_AD_STAGING_SINGLE_TENANT: optIn })).toThrow('true or false')
  })
})
