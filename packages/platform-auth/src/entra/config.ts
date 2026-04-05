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
 */
import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import type { NextAuthConfig } from 'next-auth'
import type { EntraTokenClaims, EntraSession } from './types'

// ── Provider Configuration ──────────────────────────────────────────────────

function createEntraProvider() {
  return MicrosoftEntraID({
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
    issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    authorization: {
      params: {
        scope: 'openid profile email User.Read',
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
  providers: [createEntraProvider()],

  pages: {
    signIn: '/sign-in',
    signOut: '/sign-out',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },

  callbacks: {
    /**
     * JWT callback — enrich token with Entra claims on initial sign-in.
     */
    jwt({ token, account, profile }) {
      if (account && profile) {
        const entraProfile = profile as unknown as EntraTokenClaims
        token.accessToken = account.access_token
        token.idToken = account.id_token
        token.roles = entraProfile.roles ?? []
        token.entraObjectId = entraProfile.oid
        token.groups = entraProfile.groups ?? []
        // Map first group to activeOrgId (org selection happens client-side)
        if (entraProfile.groups && entraProfile.groups.length > 0) {
          token.activeOrgId = entraProfile.groups[0]
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
        orgRole: token.orgRole as string | undefined,
        entraObjectId: token.entraObjectId as string | undefined,
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

export const handlers = nextAuth.handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: any = nextAuth.auth
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signIn: any = nextAuth.signIn
export const signOut = nextAuth.signOut
