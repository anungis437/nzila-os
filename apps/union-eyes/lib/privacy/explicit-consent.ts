/**
 * Consent methods that record an affirmative act by the person (Quebec Law 25 express consent).
 * `opt_out`, `implicit` and `implied_action` are not express consent.
 */
export const EXPLICIT_CONSENT_METHODS: readonly string[] = ['explicit_checkbox', 'opt_in'];

/**
 * True when a positive grant in a jurisdiction that requires explicit opt-in was not given by an explicit method.
 * A refusal (consentGiven=false) is never blocked: it narrows processing whatever its method.
 */
export function violatesExplicitOptIn(
  config: { explicitOptIn?: boolean | null } | null | undefined,
  consentGiven: boolean,
  consentMethod: string,
): boolean {
  return Boolean(config?.explicitOptIn) && consentGiven && !EXPLICIT_CONSENT_METHODS.includes(consentMethod);
}
