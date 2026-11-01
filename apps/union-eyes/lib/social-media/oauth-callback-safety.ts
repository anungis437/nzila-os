/**
 * OAuth callback authority must not depend on how a proxy, browser or framework
 * resolves duplicate query parameters. Parse the one unambiguous provider result.
 */
export type OAuthCallbackParameters =
  | { ok: true; code: string | null; state: string | null; providerError: string | null }
  | { ok: false };

export function parseOAuthCallbackParameters(params: URLSearchParams): OAuthCallbackParameters {
  if (['code', 'state', 'error'].some((key) => params.getAll(key).length > 1)) {
    return { ok: false };
  }
  if (params.has('code') && params.has('error')) {
    return { ok: false };
  }
  return {
    ok: true,
    code: params.get('code'),
    state: params.get('state'),
    providerError: params.get('error'),
  };
}

/**
 * A publishing identity cannot be selected by provider enumeration order.
 * A multi-page result must wait for an authenticated explicit-selection flow.
 */
export function selectUniquePublishingOrganization<T>(organizations: readonly T[]): T | null {
  return organizations.length === 1 ? organizations[0] : null;
}
