/**
 * What a stored configuration does today.
 *
 * Some administrator-saved configuration has no runtime consumer yet: nothing reads an SSO provider at sign-in, and nothing runs an
 * integration's synchronization. Saving, enabling, repointing or deleting such a row is recorded faithfully, but a response or audit
 * record that only says "updated" or "enabled" reads as though the change took effect. Every response and audit record for these
 * configurations carries this statement instead.
 *
 * When a consumer ships, flip `inEffect` here together with the capability registry entry and the tests that pin it.
 */
export interface ConfigurationEffect {
  readonly inEffect: boolean
  readonly capability: string
  readonly notice: string
}

export const SSO_SIGN_IN_EFFECT: ConfigurationEffect = {
  inEffect: false,
  capability: 'UE-SSO-SIGN-IN',
  notice:
    'This provider configuration is stored only. No sign-in, token exchange, provisioning or SCIM code reads it in this release, so enabling it or turning on auto-provisioning does not change how anyone signs in.',
}

export const INTEGRATION_SYNC_EFFECT: ConfigurationEffect = {
  inEffect: false,
  capability: 'UE-EXT-INTEGRATION-SYNC',
  notice:
    'This integration configuration is stored only. No synchronization runs from it in this release, so enabling it, setting a sync frequency or changing its endpoint does not start, schedule or redirect any data exchange.',
}

export const withConfigurationEffect = <T extends Record<string, unknown>>(row: T, effect: ConfigurationEffect) => ({ ...row, effect })
