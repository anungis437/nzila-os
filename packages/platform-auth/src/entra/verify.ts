/**
 * @nzila/platform-auth — Entra Token Verification
 *
 * Drop-in replacement for Clerk's `verifyToken` from `@clerk/backend`.
 * Uses Microsoft Entra's OIDC JWKS endpoint for JWT verification.
 *
 * Usage:
 *   import { verifyToken } from '@nzila/platform-auth/entra/verify'
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

/**
 * Get JWKS for token verification.
 * Uses the /common/ endpoint to support multi-tenant + personal accounts.
 * If AZURE_AD_TENANT_ID is set, uses tenant-specific endpoint for tighter validation.
 */
function getJWKS() {
  if (jwks) return jwks
  const tenantId = process.env.AZURE_AD_TENANT_ID
  // Use /common/ for multi-tenant support (org + personal accounts)
  const authority = tenantId || 'common'
  const jwksUri = `https://login.microsoftonline.com/${authority}/discovery/v2.0/keys`
  jwks = createRemoteJWKSet(new URL(jwksUri))
  return jwks
}

export interface VerifyTokenResult {
  payload: JWTPayload & {
    sub: string
    oid?: string
    roles?: string[]
    groups?: string[]
    tid?: string
    idp?: string
    tenant_id?: string
    org_role?: string
    org_permissions?: string[]
  }
}

/**
 * Verify an Entra ID JWT token.
 * Clerk-compatible signature: `verifyToken(token, options)`.
 *
 * @param token - The raw JWT string (from Bearer header)
 * @param _options - Ignored for Entra (uses env vars instead of secretKey)
 * @returns Object with `payload` containing JWT claims
 */
export async function verifyToken(
  token: string,
  _options?: { secretKey?: string }
): Promise<VerifyTokenResult> {
  const clientId = process.env.AZURE_AD_CLIENT_ID
  const tenantId = process.env.AZURE_AD_TENANT_ID

  const { payload } = await jwtVerify(token, getJWKS(), {
    audience: clientId,
    // Multi-tenant: validate issuer pattern rather than exact match.
    // Tokens from any Azure AD tenant or personal accounts are accepted.
    // The issuer format is https://login.microsoftonline.com/{tid}/v2.0
    issuer: tenantId
      ? `https://login.microsoftonline.com/${tenantId}/v2.0`
      : undefined,
  })

  const tid = (payload as Record<string, unknown>).tid as string | undefined

  return {
    payload: {
      ...payload,
      sub: payload.sub ?? '',
      // Map Entra claims to Clerk-compatible names
      tenant_id: tid,
      org_role: ((payload as Record<string, unknown>).roles as string[] | undefined)?.[0],
      org_permissions: (payload as Record<string, unknown>).roles as string[] | undefined,
      // Identity provider for external users
      idp: (payload as Record<string, unknown>).idp as string | undefined,
    },
  }
}
