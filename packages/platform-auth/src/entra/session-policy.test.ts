import { describe, expect, it } from 'vitest'
import { resolveEntraSessionMaxAge } from './session-policy'

const dedicatedStaging = { TARGET_ENVIRONMENT: 'staging', AZURE_AD_STAGING_SINGLE_TENANT: 'true',
  AZURE_AD_TENANT_ID: '50820000-0000-0000-0000-000000000001' }

describe('native staging session lifetime', () => {
  it.each([undefined, 'production', 'staging', 'development'])('keeps the 24 hour default in %s', (environment) => {
    expect(resolveEntraSessionMaxAge({ TARGET_ENVIRONMENT: environment })).toBe(86400)
  })
  it.each(['60', '900', '86400'])('uses an actual bounded Auth.js session lifetime of %s seconds', (seconds) => {
    expect(resolveEntraSessionMaxAge({ ...dedicatedStaging,
      AZURE_AD_STAGING_SESSION_MAX_AGE_SECONDS: seconds })).toBe(Number(seconds))
  })
  it.each(['', '0', '59', '86401', '-60', '1.5', '900s', ' 900', '900 ', '09', 'Infinity', '1e3'])('fails closed on invalid lifetime %s', (seconds) => {
    expect(() => resolveEntraSessionMaxAge({ ...dedicatedStaging,
      AZURE_AD_STAGING_SESSION_MAX_AGE_SECONDS: seconds })).toThrow('integer from 60 through 86400')
  })
  it.each([undefined, 'production', 'development', 'Staging'])('rejects the override outside staging: %s', (environment) => {
    expect(() => resolveEntraSessionMaxAge({ ...dedicatedStaging, TARGET_ENVIRONMENT: environment,
      AZURE_AD_STAGING_SESSION_MAX_AGE_SECONDS: '900' })).toThrow('dedicated single-tenant staging registration')
  })
  it.each([undefined, 'false', 'TRUE'])('rejects a non-dedicated provider: %s', (optIn) => {
    expect(() => resolveEntraSessionMaxAge({ ...dedicatedStaging, AZURE_AD_STAGING_SINGLE_TENANT: optIn,
      AZURE_AD_STAGING_SESSION_MAX_AGE_SECONDS: '900' })).toThrow('dedicated single-tenant staging registration')
  })
  it('also validates the dedicated tenant instead of accepting the override on a common issuer', () => {
    expect(() => resolveEntraSessionMaxAge({ ...dedicatedStaging, AZURE_AD_TENANT_ID: 'common',
      AZURE_AD_STAGING_SESSION_MAX_AGE_SECONDS: '900' })).toThrow('nonzero AZURE_AD_TENANT_ID GUID')
  })
})
