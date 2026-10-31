import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateSsoProviderInput } from '@/lib/sso/provider-input'

const read = (path: string) => readFileSync(join(fileURLToPath(new URL('../../../', import.meta.url)), path), 'utf8')

describe('B51 SSO provider input (DEF-0B7-PLT-SSO-CREATE-STORES-UNVALIDATED-CONFIGURATION-ENABLED-BY-DEFAULT)', () => {
  const oidc = { name: 'IdP', providerType: 'oidc', oidcIssuer: 'https://idp.example.test', oidcClientId: 'client' }

  it('accepts a complete oidc and saml configuration', () => {
    expect(validateSsoProviderInput(oidc, true)).toMatchObject({ providerType: 'oidc', oidcClientId: 'client' })
    expect(
      validateSsoProviderInput({ name: 'S', providerType: 'saml', samlEntityId: 'urn:x', samlSsoUrl: 'https://sso.example.test/s', samlCertificate: 'CERT' }, true),
    ).toMatchObject({ providerType: 'saml' })
  })

  it.each([
    ['an unknown type', { ...oidc, providerType: 'ldap' }],
    ['an http issuer', { ...oidc, oidcIssuer: 'http://idp.example.test' }],
    ['an issuer with credentials', { ...oidc, oidcIssuer: 'https://u:p@idp.example.test' }],
    ['a malformed url', { ...oidc, oidcIssuer: 'not a url' }],
    ['an over-long name', { ...oidc, name: 'n'.repeat(201) }],
  ])('refuses %s', (_name, input) => {
    expect(() => validateSsoProviderInput(input, false)).toThrow()
  })

  it('requires the fields of the type only when the provider is to be enabled', () => {
    expect(() => validateSsoProviderInput({ name: 'IdP', providerType: 'oidc' }, false)).not.toThrow()
    expect(() => validateSsoProviderInput({ name: 'IdP', providerType: 'oidc' }, true)).toThrow(/required to enable/)
  })

  it('creates a provider disabled and without auto-provisioning by default', () => {
    const route = read('app/api/enterprise/sso/providers/route.ts')
    expect(route).toContain('autoProvision: autoProvision ?? false')
    expect(route).toContain('enabled: enabled ?? false')
    expect(route).not.toContain('enabled ?? true')
  })
})

describe('B51 entitlement list (DEF-0B7-PLT-ENT-LISTS-EXPIRED-AND-UNBACKED-ENTITLEMENTS-AS-ACTIVE)', () => {
  it('lists only what the server-side check allows', () => {
    const route = read('app/api/entitlements/route.ts')
    expect(route).toContain('checkModuleEntitlement(orgId, r.featureKey)).allowed')
    expect(route).toContain('.limit(200)')
  })
})
