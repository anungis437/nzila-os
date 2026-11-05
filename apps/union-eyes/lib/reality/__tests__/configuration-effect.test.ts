/**
 * F06 R5 — what a stored but unconsumed configuration says it needs before it can do anything.
 *
 * SSO providers and integrations are saved by administrators and read by no runtime consumer. The statement they carry names the one blocked
 * operation and judges each requirement from the stored row: the configuration's own completeness is checked, and an approval or provider-side
 * fact that nothing records is reported unmet, never assumed. Secrets are inspected for presence and never returned.
 */
import { describe, expect, it } from 'vitest'
import {
  INTEGRATION_SYNC_EFFECT,
  SSO_SIGN_IN_EFFECT,
  integrationReadiness,
  ssoReadiness,
  withConfigurationEffect,
} from '../configuration-effect'

const unmetCodes = (r: { requirements: readonly { code: string; met: boolean }[] }) => r.requirements.filter((x) => !x.met).map((x) => x.code)

describe('the statement is specific', () => {
  it('names the one blocked operation and what it requires, with who owns each requirement', () => {
    expect(SSO_SIGN_IN_EFFECT.inEffect).toBe(false)
    expect(SSO_SIGN_IN_EFFECT.blockedOperation.operation).toBe('auth.sso.federated_sign_in')
    expect(SSO_SIGN_IN_EFFECT.blockedOperation.requires.join(' ')).toMatch(/institution approves/)
    expect(INTEGRATION_SYNC_EFFECT.inEffect).toBe(false)
    expect(INTEGRATION_SYNC_EFFECT.blockedOperation.operation).toBe('integration.sync.execute')
    expect(INTEGRATION_SYNC_EFFECT.blockedOperation.requires.join(' ')).toMatch(/approves the external system/)
  })
})

describe('SSO provider readiness', () => {
  const completeOidc = { providerType: 'oidc', oidcIssuer: 'https://idp.example.test', oidcClientId: 'c', oidcClientSecret: 'enc:abc', oidcAuthorizationEndpoint: 'https://idp/a', oidcTokenEndpoint: 'https://idp/t' }
  const completeSaml = { providerType: 'saml', samlEntityId: 'e', samlSsoUrl: 'https://idp/sso', samlCertificate: '-----CERT-----' }

  it('judges configuration completeness from the row, and is still not ready: approval, domain verification and federation are not recorded anywhere', () => {
    const r = ssoReadiness(completeOidc)
    expect(r.ready).toBe(false)
    expect(r.requirements.find((x) => x.code === 'configuration_complete')?.met).toBe(true)
    expect(unmetCodes(r)).toEqual(['provider_approved_by_institution', 'email_domain_ownership_verified', 'platform_authentication_federation'])
    expect(r.requirements.find((x) => x.code === 'provider_approved_by_institution')?.owner).toBe('institution')
    expect(ssoReadiness(completeSaml).requirements[0].met).toBe(true)
  })

  it('reports an incomplete configuration as such, for each provider type', () => {
    expect(ssoReadiness({ ...completeOidc, oidcClientSecret: null }).requirements[0].met).toBe(false)
    expect(ssoReadiness({ ...completeOidc, oidcTokenEndpoint: '  ' }).requirements[0].met).toBe(false)
    expect(ssoReadiness({ ...completeSaml, samlCertificate: null }).requirements[0].met).toBe(false)
  })

  it('never carries a secret: only booleans and fixed descriptions', () => {
    expect(JSON.stringify(ssoReadiness({ ...completeOidc, oidcClientSecret: 'super-secret-value' }))).not.toContain('super-secret-value')
  })
})

describe('integration readiness', () => {
  it('judges the connection and the credentials from the row and still reports approval and adapter as unmet', () => {
    const r = integrationReadiness({ connectionType: 'api', apiEndpoint: 'https://x.example.test', authType: 'oauth2', credentials: { token: 'secret' } })
    expect(r.ready).toBe(false)
    expect(r.requirements.filter((x) => x.met).map((x) => x.code)).toEqual(['connection_complete', 'credentials_issued'])
    expect(unmetCodes(r)).toEqual(['external_system_approved', 'adapter_registered'])
    expect(JSON.stringify(r)).not.toContain('secret')
  })

  it('treats an SFTP connection by its host and a missing credential as the provider\'s to issue', () => {
    const r = integrationReadiness({ connectionType: 'sftp', sftpHost: 'sftp.example.test', credentials: null })
    expect(r.requirements.find((x) => x.code === 'connection_complete')?.met).toBe(true)
    expect(r.requirements.find((x) => x.code === 'credentials_issued')).toMatchObject({ met: false, owner: 'provider' })
    expect(integrationReadiness({ connectionType: 'api' }).requirements[0].met).toBe(false)
  })
})

describe('withConfigurationEffect', () => {
  it('adds the effect, and the readiness only when it was judged', () => {
    expect(withConfigurationEffect({ id: 'a' }, SSO_SIGN_IN_EFFECT)).toEqual({ id: 'a', effect: SSO_SIGN_IN_EFFECT })
    const judged = ssoReadiness({ providerType: 'oidc' })
    expect(withConfigurationEffect({ id: 'a' }, SSO_SIGN_IN_EFFECT, judged)).toEqual({ id: 'a', effect: SSO_SIGN_IN_EFFECT, readiness: judged })
  })
})
