/**
 * @nzila/platform-auth — Entra ID NextAuth Configuration
 *
 * Centralised NextAuth v5 configuration with Microsoft Entra ID provider.
 * All apps import this config instead of configuring auth individually.
 *
 * Usage in app:
 *   // app/api/auth/[...nextauth]/route.ts
 *   export { handlers } from '@nzila/platform-auth/entra/config'
 *
 *   // middleware.ts
 *   export { auth as middleware } from '@nzila/platform-auth/entra/config'
 *
 *   // server component / action
 *   import { auth } from '@nzila/platform-auth/entra/config'
 *   const session = await auth()
 *
 * Required environment variables:
 *   AZURE_AD_CLIENT_ID
 *   AZURE_AD_CLIENT_SECRET
 *   AZURE_AD_TENANT_ID
 *   AUTH_SECRET  (NextAuth secret — generate with `openssl rand -base64 32`)
 *
 * Optional dedicated single-tenant staging registration:
 *   AZURE_AD_STAGING_SINGLE_TENANT=true
 *   TARGET_ENVIRONMENT=staging
 *   AZURE_AD_TENANT_ID=<directory GUID; never common/organizations>
 * This opt-in fails closed outside staging or without a valid tenant GUID.
 * Omit it (or set false) to preserve the existing /common issuer everywhere.
 * AZURE_AD_STAGING_SESSION_MAX_AGE_SECONDS may shorten the real idle session
 * lifetime to 60..86400 seconds for that dedicated staging registration.
 * Omit it to retain the 24-hour default. Other environments reject the override.
 */
import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import type { NextAuthConfig } from 'next-auth'
import type { EntraTokenClaims, EntraSession } from './types'
import { resolveEntraIssuer } from './issuer'
import { resolveEntraSessionMaxAge } from './session-policy'

// ── Auto-Provisioning Hook ──────────────────────────────────────────────────

/**
 * Optional hook that apps can register to auto-provision users on first sign-in.
 * Called during the JWT callback when `account` is present (initial sign-in).
 *
 * Usage:
 *   import { setOnSignInHook } from '@nzila/platform-auth/entra/config'
 *   setOnSignInHook(async ({ entraObjectId, email, name, tenantId, identityProvider }) => {
 *     // Upsert user in your database
 *   })
 */
export type OnSignInHookParams = {
  entraObjectId: string
  email: string
  name: string
  tenantId?: string
  identityProvider: string
  isExternalUser: boolean
}

let onSignInHook: ((params: OnSignInHookParams) => Promise<void>) | null = null

export function setOnSignInHook(hook: (params: OnSignInHookParams) => Promise<void>) {
  onSignInHook = hook
}

// ── Provider Configuration ──────────────────────────────────────────────────

const AZURE_AD_TENANT_ID = process.env.AZURE_AD_TENANT_ID

/**
 * Default issuer uses `/common/` for multi-tenant + personal accounts,
 * which allows:
 *   • Organizational accounts from any Azure AD tenant
 *   • Personal Microsoft accounts (Outlook.com, Hotmail, etc.)
 *   • B2B guest users authenticated via email OTP or federated IdPs
 *
 * Token validation uses audience (client ID) check; the `tid` claim
 * is captured in the JWT callback for tenant-specific logic.
 * A dedicated staging registration can explicitly select its directory
 * issuer through the validated, staging-only opt-in documented above.
 */
function createEntraProvider() {
  return MicrosoftEntraID({
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
    issuer: resolveEntraIssuer({
      AZURE_AD_STAGING_SINGLE_TENANT: process.env.AZURE_AD_STAGING_SINGLE_TENANT,
      AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID,
      TARGET_ENVIRONMENT: process.env.TARGET_ENVIRONMENT,
    }),
    authorization: {
      params: {
        scope: 'openid profile email User.Read',
        // Hint the user's home tenant for org accounts while still
        // accepting personal accounts that redirect through /common
        ...(AZURE_AD_TENANT_ID ? { domain_hint: 'organizations' } : {}),
      },
    },
    profile(profile) {
      const p = profile as unknown as EntraTokenClaims
      return {
        id: p.oid ?? p.sub ?? '',
        name: p.name ?? p.preferred_username ?? '',
        email: p.email ?? p.preferred_username ?? '',
        image: p.picture ?? null,
      }
    },
  })
}

// ── NextAuth Configuration ──────────────────────────────────────────────────

export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [createEntraProvider()],

  pages: {
    signIn: '/sign-in',
    signOut: '/sign-out',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: resolveEntraSessionMaxAge({
      AZURE_AD_STAGING_SESSION_MAX_AGE_SECONDS: process.env.AZURE_AD_STAGING_SESSION_MAX_AGE_SECONDS,
      AZURE_AD_STAGING_SINGLE_TENANT: process.env.AZURE_AD_STAGING_SINGLE_TENANT,
      AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID,
      TARGET_ENVIRONMENT: process.env.TARGET_ENVIRONMENT,
    }),
  },

  callbacks: {
    /**
     * JWT callback — enrich token with Entra claims on initial sign-in.
     * Handles both organizational and personal Microsoft accounts.
     */
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const entraProfile = profile as unknown as EntraTokenClaims
        token.accessToken = account.access_token
        token.idToken = account.id_token
        token.roles = entraProfile.roles ?? []
        token.entraObjectId = entraProfile.oid
        token.groups = entraProfile.groups ?? []
        // Capture tenant and identity provider for multi-tenant support
        token.tenantId = entraProfile.tid
        token.identityProvider = entraProfile.idp ?? 'microsoft'
        // Track if user is from home tenant vs external/personal
        token.isExternalUser = AZURE_AD_TENANT_ID
          ? entraProfile.tid !== AZURE_AD_TENANT_ID
          : false
        // Retain this first-group selector for legacy consumers only. It is
        // explicitly tagged and is not canonical membership or permission.
        if (entraProfile.groups && entraProfile.groups.length > 0) {
          token.activeOrgId = entraProfile.groups[0]
          token.activeOrgSource = 'entra-group-legacy'
        }

        // Auto-provision user on first sign-in (if hook is registered)
        if (onSignInHook && entraProfile.oid) {
          try {
            await onSignInHook({
              entraObjectId: entraProfile.oid,
              email: entraProfile.email ?? entraProfile.preferred_username ?? '',
              name: entraProfile.name ?? '',
              tenantId: entraProfile.tid,
              identityProvider: entraProfile.idp ?? 'microsoft',
              isExternalUser: token.isExternalUser as boolean,
            })
          } catch (err) {
            console.error('[platform-auth] Auto-provision hook failed:', err)
          }
        }
      }
      return token
    },

    /**
     * Session callback — expose Entra claims to client/server session.
     */
    session({ session, token }): EntraSession {
      return {
        ...session,
        accessToken: token.accessToken as string | undefined,
        idToken: token.idToken as string | undefined,
        roles: (token.roles as string[]) ?? [],
        activeOrgId: token.activeOrgId as string | undefined,
        activeOrgSource: token.activeOrgSource as 'entra-group-legacy' | undefined,
        orgRole: token.orgRole as string | undefined,
        entraObjectId: token.entraObjectId as string | undefined,
        tenantId: token.tenantId as string | undefined,
        identityProvider: token.identityProvider as string | undefined,
        isExternalUser: (token.isExternalUser as boolean) ?? false,
      }
    },

    /**
     * Authorized callback — protect routes in middleware.
     */
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const isPublicPath =
        request.nextUrl.pathname === '/' ||
        request.nextUrl.pathname.startsWith('/sign-in') ||
        request.nextUrl.pathname.startsWith('/sign-up') ||
        request.nextUrl.pathname.startsWith('/onboarding') ||
        request.nextUrl.pathname.startsWith('/api/health') ||
        request.nextUrl.pathname.startsWith('/api/webhooks') ||
        request.nextUrl.pathname.startsWith('/api/auth') ||
        request.nextUrl.pathname.startsWith('/_next')

      if (isPublicPath) return true
      return isLoggedIn
    },
  },
}

// ── NextAuth Instance ───────────────────────────────────────────────────────

const nextAuth = NextAuth(authConfig)

export type PlatformAuthFn = {
  (): Promise<EntraSession | null>
  <T>(middleware: (req: unknown) => T): T
}

export type PlatformSignInFn = (...args: unknown[]) => Promise<unknown>

export const handlers = nextAuth.handlers
export const auth: PlatformAuthFn = nextAuth.auth as unknown as PlatformAuthFn
export const signIn: PlatformSignInFn = nextAuth.signIn as unknown as PlatformSignInFn
export const signOut = nextAuth.signOut
