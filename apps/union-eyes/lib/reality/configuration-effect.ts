/**
 * What a stored configuration does today, and exactly what stands between it and doing something.
 *
 * Some administrator-saved configuration has no runtime consumer yet: nothing reads an SSO provider at sign-in, and nothing runs an
 * integration's synchronization. Saving, enabling, repointing or deleting such a row is recorded faithfully, but a response or audit
 * record that only says "updated" or "enabled" reads as though the change took effect. Every response and audit record for these
 * configurations carries this statement instead.
 *
 * The statement is specific, not a blanket "not implemented". It names the ONE operation that is blocked and what each requirement is
 * and who owns it (the configuration itself, engineering, an institutional approval, or the provider). A requirement is reported met only
 * when the stored row proves it; approvals and provider-side facts that nothing in the system records are reported unmet, never assumed.
 * No provider is activated here, and no approval is invented.
 *
 * When a consumer ships, flip `inEffect` here together with the capability registry entry and the tests that pin it.
 */
export type RequirementOwner = 'configuration' | 'engineering' | 'institution' | 'provider'

export interface Requirement {
  readonly code: string
  readonly owner: RequirementOwner
  readonly met: boolean
  readonly detail: string
}

export interface BlockedOperation {
  readonly operation: string
  readonly requires: readonly string[]
}

export interface ConfigurationEffect {
  readonly inEffect: boolean
  readonly capability: string
  readonly notice: string
  readonly blockedOperation: BlockedOperation
}

export const SSO_SIGN_IN_EFFECT: ConfigurationEffect = {
  inEffect: false,
  capability: 'UE-SSO-SIGN-IN',
  notice:
    'This provider configuration is stored only. No sign-in, token exchange, provisioning or SCIM code reads it in this release, so enabling it or turning on auto-provisioning does not change how anyone signs in.',
  blockedOperation: {
    operation: 'auth.sso.federated_sign_in',
    requires: [
      'complete provider configuration (configuration)',
      'the institution approves this identity provider for this organization (institution)',
      'verified ownership of the sign-in email domains (engineering, after approval)',
      'platform authentication supports federation through this provider (engineering, after approval)',
    ],
  },
}

export const INTEGRATION_SYNC_EFFECT: ConfigurationEffect = {
  inEffect: false,
  capability: 'UE-EXT-INTEGRATION-SYNC',
  notice:
    'This integration configuration is stored only. No synchronization runs from it in this release, so enabling it, setting a sync frequency or changing its endpoint does not start, schedule or redirect any data exchange.',
  blockedOperation: {
    operation: 'integration.sync.execute',
    requires: [
      'complete connection configuration (configuration)',
      'the institution approves the external system and the data it may exchange (institution)',
      'credentials issued by the external system (provider)',
      'an approved adapter is registered for the provider (engineering, after approval)',
    ],
  },
}

const present = (value: unknown): boolean => (typeof value === 'string' ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined)
const requirement = (code: string, owner: RequirementOwner, met: boolean, detail: string): Requirement => ({ code, owner, met, detail })

type Row = Record<string, unknown>

export interface Readiness {
  /** True only when every requirement is met. Approvals and provider-side facts the system does not record count as unmet. */
  readonly ready: boolean
  readonly requirements: readonly Requirement[]
}

const readiness = (requirements: Requirement[]): Readiness => ({ ready: requirements.every((r) => r.met), requirements })

/** Judges a stored SSO provider row. Secrets are inspected only for presence and never returned. */
export function ssoReadiness(row: Row): Readiness {
  const saml = row.providerType === 'saml'
  const complete = saml
    ? present(row.samlEntityId) && present(row.samlSsoUrl) && present(row.samlCertificate)
    : present(row.oidcIssuer) && present(row.oidcClientId) && present(row.oidcClientSecret) && present(row.oidcAuthorizationEndpoint) && present(row.oidcTokenEndpoint)
  return readiness([
    requirement('configuration_complete', 'configuration', complete, saml ? 'entity id, single sign-on URL and certificate' : 'issuer, client id, client secret, authorization and token endpoints'),
    requirement('provider_approved_by_institution', 'institution', false, 'no approval of an identity provider for this organization is recorded anywhere'),
    requirement('email_domain_ownership_verified', 'engineering', false, 'no domain verification exists, so a provider could claim another organization\'s addresses'),
    requirement('platform_authentication_federation', 'engineering', false, 'platform authentication does not federate through organization-configured providers'),
  ])
}

/** Judges a stored integration row. Credentials are inspected only for presence and never returned. */
export function integrationReadiness(row: Row): Readiness {
  const file = row.connectionType === 'sftp'
  const complete = file ? present(row.sftpHost) : present(row.apiEndpoint) && present(row.authType)
  return readiness([
    requirement('connection_complete', 'configuration', complete, file ? 'SFTP host' : 'API endpoint and authentication type'),
    requirement('external_system_approved', 'institution', false, 'no approval of this external system or of the data it may exchange is recorded'),
    requirement('credentials_issued', 'provider', present(row.credentials), 'credentials issued by the external system'),
    requirement('adapter_registered', 'engineering', false, 'no approved adapter is registered for this provider'),
  ])
}

export const withConfigurationEffect = <T extends Record<string, unknown>>(row: T, effect: ConfigurationEffect, judged?: Readiness) =>
  judged ? { ...row, effect, readiness: judged } : { ...row, effect }
