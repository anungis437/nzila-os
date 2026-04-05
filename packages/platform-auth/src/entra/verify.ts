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

function getJWKS() {
  if (jwks) return jwks
  const tenantId = process.env.AZURE_AD_TENANT_ID
  if (!tenantId) {
    throw new Error('AZURE_AD_TENANT_ID is required for token verification')
  }
  const jwksUri = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`
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
    issuer: tenantId
      ? `https://login.microsoftonline.com/${tenantId}/v2.0`
      : undefined,
  })

  return {
    payload: {
      ...payload,
      sub: payload.sub ?? '',
      // Map Entra claims to Clerk-compatible names
      tenant_id: (payload as Record<string, unknown>).tid as string | undefined,
      org_role: ((payload as Record<string, unknown>).roles as string[] | undefined)?.[0],
      org_permissions: (payload as Record<string, unknown>).roles as string[] | undefined,
    },
  }
}
