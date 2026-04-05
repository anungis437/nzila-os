/**
 * @nzila/platform-auth — Entra ID Type Extensions
 *
 * Extends NextAuth session types to include org context
 * and app role claims from Microsoft Entra ID tokens.
 */
import type { DefaultSession } from 'next-auth'

/** App roles defined in Entra app registration. */
export interface EntraAppRoles {
  roles: string[]
}

/** Extended NextAuth session with Entra-specific data. */
export interface EntraSession extends DefaultSession {
  accessToken?: string
  idToken?: string
  roles: string[]
  activeOrgId?: string
  orgRole?: string
  entraObjectId?: string
  /** Entra tenant ID the user authenticated from. */
  tenantId?: string
  /** Identity provider (e.g. 'microsoft', 'google.com', 'mail'). */
  identityProvider?: string
  /** True if user is from an external tenant or personal account. */
  isExternalUser?: boolean
}

/** Entra token claims relevant to Nzila platform. */
export interface EntraTokenClaims {
  oid?: string // Object ID
  sub?: string // Subject
  preferred_username?: string
  email?: string
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
  roles?: string[] // App role assignments
  groups?: string[] // Group memberships (used as org IDs)
  tid?: string // Tenant ID
  idp?: string // Identity provider (external users)
  wids?: string[] // Directory role template IDs
}

/** Entra provider configuration. */
export interface EntraConfig {
  clientId: string
  clientSecret: string
  tenantId: string
  /** Redirect URI for auth callbacks (e.g. http://localhost:3000/api/auth/callback/microsoft-entra-id). */
  redirectUri?: string
  /** Additional scopes beyond openid profile email. */
  additionalScopes?: string[]
}
