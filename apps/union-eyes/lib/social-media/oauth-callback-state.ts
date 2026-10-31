/**
 * Validate a complete OAuth redirect context before consuming pending connection cookies.
 * A mismatched or malformed request cannot cancel a legitimate in-progress connection.
 * Provider authorization-code redirects use GET; a valid callback consumes its cookies
 * before exchanging its code with the provider.
 */
export const OAUTH_PLATFORMS = ['facebook', 'instagram', 'twitter', 'linkedin'] as const;
export type OAuthPlatform = (typeof OAUTH_PLATFORMS)[number];
export type OAuthCallbackProblem =
  | 'state_mismatch'
  | 'session_mismatch'
  | 'organization_mismatch'
  | 'unsupported_platform'
  | 'missing_authorization_code'
  | 'missing_pkce_verifier';

export interface OAuthCallbackContext {
  state: string | null;
  code: string | null;
  providerError: string | null;
  userId: string;
  organizationId: string;
  storedState: string | null;
  storedPlatform: string | null;
  storedUserId: string | null;
  storedOrganizationId: string | null;
  codeVerifier: string | null;
}

export type OAuthCallbackCheck =
  | { ok: true; platform: OAuthPlatform }
  | { ok: false; reason: OAuthCallbackProblem };

export function validateOAuthCallbackContext(context: OAuthCallbackContext): OAuthCallbackCheck {
  if (!context.state || !context.storedState || context.storedState !== context.state) {
    return { ok: false, reason: 'state_mismatch' };
  }
  if (!context.storedUserId || context.storedUserId !== context.userId) {
    return { ok: false, reason: 'session_mismatch' };
  }
  if (!context.storedOrganizationId || context.storedOrganizationId !== context.organizationId) {
    return { ok: false, reason: 'organization_mismatch' };
  }
  if (!OAUTH_PLATFORMS.some((platform) => platform === context.storedPlatform)) {
    return { ok: false, reason: 'unsupported_platform' };
  }
  if (!context.providerError && !context.code) {
    return { ok: false, reason: 'missing_authorization_code' };
  }
  if (!context.providerError && context.storedPlatform === 'twitter' && !context.codeVerifier) {
    return { ok: false, reason: 'missing_pkce_verifier' };
  }
  return { ok: true, platform: context.storedPlatform as OAuthPlatform };
}
