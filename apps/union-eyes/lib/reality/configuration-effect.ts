/**
 * What a stored configuration does today, and exactly what stands between it and doing something.
 *
 * Administrator-saved configuration must state whether a qualified runtime consumer exists. OIDC SSO now has one, but only for an
 * independently approved immutable provider version and a pre-provisioned subject binding. Generic integration configuration still has
 * no approved synchronization consumer. Every response and audit record carries the corresponding statement instead of implying that
 * storing a row activated capabilities that do not exist.
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
  inEffect: true,
  capability: 'UE-SSO-SIGN-IN',
  notice:
    'An independently approved OIDC configuration is consumed by the federated sign-in flow. SAML, just-in-time provisioning and SCIM activation remain unavailable.',
  blockedOperation: {
    operation: 'auth.sso.federated_sign_in',
    requires: [
      'complete provider configuration (configuration)',
      'the institution approves this identity provider for this organization (institution)',
      'a pre-provisioned verified provider-subject binding (institution)',
      'an active membership in the configured organization (institution)',
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
    : present(row.oidcIssuer) && present(row.oidcClientId) && present(row.oidcClientSecret)
  return readiness([
    requirement('configuration_complete', 'configuration', complete, saml ? 'entity id, single sign-on URL and certificate' : 'issuer, client id and client secret; endpoints are issuer-discovered and same-host constrained'),
    requirement('provider_approved_by_institution', 'institution', present(row.approvedBy) && present(row.approvedAt) && present(row.approvalReference), 'distinct tenant approval and its evidence reference'),
    requirement('provider_subject_binding', 'institution', false, 'provider-list readiness cannot establish a caller-specific verified immutable subject binding; sign-in checks it and never binds by email'),
    requirement('platform_authentication_federation', 'engineering', !saml, 'OIDC state, nonce, PKCE, token validation and opaque session promotion are wired; SAML is unavailable'),
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
