import { decryptCalendarToken } from './token-crypto'

export type ProviderRevocation = 'revoked' | 'not_supported' | 'failed'

const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const REVOKE_TIMEOUT_MS = 5000

/**
 * Asks the provider to end the grant a connection holds. Google exposes a token revocation endpoint. Microsoft's v2.0 identity
 * platform has no per-token revocation (the only call, revokeSignInSessions, ends every session of the person and is not ours to
 * make), so it reports not_supported and the member removes the app's access in their Microsoft account. A failure never blocks the
 * local deletion: the credentials are removed either way, and the result says what the provider did.
 */
export async function revokeProviderGrant(
  provider: string,
  tokens: { accessToken: string | null; refreshToken: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderRevocation> {
  if (provider !== 'google') return 'not_supported'
  try {
    // Revoking the refresh token also ends the access tokens issued from it.
    const stored = tokens.refreshToken ?? tokens.accessToken
    if (!stored) return 'failed'
    const response = await fetchImpl(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: decryptCalendarToken(stored) }),
      signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS),
    })
    return response.ok ? 'revoked' : 'failed'
  } catch {
    return 'failed'
  }
}
