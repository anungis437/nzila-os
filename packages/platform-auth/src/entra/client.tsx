'use client'

/**
 * @nzila/platform-auth — Entra Client-Side Auth Components & Hooks
 *
 * Drop-in replacements for Clerk's client-side API:
 *   - <ClerkProvider>          → <AuthProvider>
 *   - useUser()                → useUser()
 *   - useAuth()                → useAuth()
 *   - <UserButton />           → <UserButton />
 *   - <OrganizationSwitcher /> → <OrgSwitcher />
 *
 * All components use NextAuth's SessionProvider under the hood.
 * Falls back to PG session (/api/auth/me) for password-based auth
 * when no NextAuth session exists.
 */
import {
  SessionProvider,
  useSession,
  signIn as nextAuthSignIn,
  signOut as nextAuthSignOut,
} from 'next-auth/react'
import type { Session } from 'next-auth'
import { type ReactNode, useState, useEffect, useRef } from 'react'
import type { EntraSession } from './types'

// ── PG-session fallback for password-based auth ─────────────────────────────

interface PgAuthUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  organizationId: string | null
  sessionId: string | null
}

/**
 * Fetches the current user from the PG session cookie (/api/auth/me).
 * Returns null if not authenticated or the endpoint doesn't exist.
 */
async function fetchPgUser(signal?: AbortSignal): Promise<PgAuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', {
      credentials: 'include',
      signal,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.user ?? null
  } catch {
    return null
  }
}

/**
 * Hook that resolves the PG-session user when NextAuth has no session.
 * Only fires the fetch once per mount; caches the result.
 */
function usePgSession(nextAuthStatus: string) {
  const [pgUser, setPgUser] = useState<PgAuthUser | null>(null)
  const [pgLoaded, setPgLoaded] = useState(false)
  const fetched = useRef(false)

  useEffect(() => {
    // Only check PG session if NextAuth definitely has no session
    if (nextAuthStatus === 'loading') return
    if (nextAuthStatus === 'authenticated') {
      setPgLoaded(true)
      return
    }
    if (fetched.current) return
    fetched.current = true

    const controller = new AbortController()
    fetchPgUser(controller.signal).then(user => {
      setPgUser(user)
      setPgLoaded(true)
    })
    return () => controller.abort()
  }, [nextAuthStatus])

  return { pgUser, pgLoaded }
}

// ── AuthProvider ────────────────────────────────────────────────────────────

export interface AuthProviderProps {
  children: ReactNode
  session?: Session | null
  /** Base URL for the auth API routes. Default: /api/auth */
  basePath?: string
}

/**
 * Root auth provider — replaces `<ClerkProvider>`.
 * Wrap your app layout with this component.
 */
export function AuthProvider({ children, session, basePath }: AuthProviderProps) {
  return (
    <SessionProvider session={session} basePath={basePath}>
      {children}
    </SessionProvider>
  )
}

// ── useAuth() Hook ──────────────────────────────────────────────────────────

export interface AuthState {
  /** Whether auth state has loaded. */
  isLoaded: boolean
  /** Whether the user is signed in. */
  isSignedIn: boolean
  /** User ID from Entra (object ID). */
  userId: string | null
  /** Active organization ID. */
  orgId: string | null
  /** Organization role. */
  orgRole: string | null
  /** App roles from Entra. */
  roles: string[]
  /** Identity provider (e.g. 'microsoft', 'google.com'). */
  identityProvider: string | null
  /** Whether user is from an external tenant or personal account. */
  isExternalUser: boolean
  /** Get the access token for API calls. */
  getToken: () => Promise<string | null>
  /** Sign the user out. */
  signOut: () => Promise<void>
}

/**
 * Client-side auth state hook — replaces Clerk's `useAuth()`.
 * Falls back to PG session cookie for password-based auth.
 */
export function useAuth(): AuthState {
  const { data: session, status } = useSession()
  const entra = session as EntraSession | null
  const { pgUser, pgLoaded } = usePgSession(status)

  // NextAuth session takes priority
  if (status === 'authenticated') {
    return {
      isLoaded: true,
      isSignedIn: true,
      userId: entra?.entraObjectId ?? session?.user?.id ?? null,
      orgId: entra?.activeOrgId ?? null,
      orgRole: entra?.orgRole ?? null,
      roles: entra?.roles ?? [],
      identityProvider: entra?.identityProvider ?? null,
      isExternalUser: entra?.isExternalUser ?? false,
      getToken: async () => entra?.accessToken ?? null,
      signOut: async () => {
        await nextAuthSignOut({ redirectTo: '/' })
      },
    }
  }

  // PG session fallback (password-based auth)
  if (pgUser) {
    return {
      isLoaded: true,
      isSignedIn: true,
      userId: pgUser.id,
      orgId: pgUser.organizationId,
      orgRole: null,
      roles: [],
      identityProvider: null,
      isExternalUser: false,
      getToken: async () => null,
      signOut: async () => {
        // Call PG logout endpoint, then redirect
        try {
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        } catch { /* ignore */ }
        window.location.href = '/'
      },
    }
  }

  // Still loading
  return {
    isLoaded: status !== 'loading' && pgLoaded,
    isSignedIn: false,
    userId: null,
    orgId: null,
    orgRole: null,
    roles: [],
    identityProvider: null,
    isExternalUser: false,
    getToken: async () => null,
    signOut: async () => {
      await nextAuthSignOut({ redirectTo: '/' })
    },
  }
}

// ── useUser() Hook ──────────────────────────────────────────────────────────

export interface UserState {
  /** Whether user data has loaded. */
  isLoaded: boolean
  /** Whether the user is signed in. */
  isSignedIn: boolean
  /** User object (null when not signed in). */
  user: {
    id: string
    fullName: string | null
    primaryEmailAddress: { emailAddress: string } | null
    primaryPhoneNumber: { phoneNumber: string } | null
    emailAddresses: { emailAddress: string }[]
    username: string | null
    imageUrl: string | null
    firstName: string | null
    lastName: string | null
    createdAt: Date | null
    /** App roles from Entra. */
    publicMetadata: Record<string, unknown>
    privateMetadata: Record<string, unknown>
    organizationMemberships: { organization: { id: string }; role: string }[]
  } | null
}

/**
 * Client-side user data hook — replaces Clerk's `useUser()`.
 * Provides the same shape so app code doesn't need to change.
 * Falls back to PG session for password-based auth.
 */
export function useUser(): UserState {
  const { data: session, status } = useSession()
  const entra = session as EntraSession | null
  const { pgUser, pgLoaded } = usePgSession(status)

  // NextAuth session
  if (status === 'authenticated' && session?.user) {
    const nameParts = session.user.name?.split(' ') ?? []
    return {
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: entra?.entraObjectId ?? session.user.id ?? '',
        fullName: session.user.name ?? null,
        primaryEmailAddress: session.user.email
          ? { emailAddress: session.user.email }
          : null,
        primaryPhoneNumber: null,
        emailAddresses: session.user.email
          ? [{ emailAddress: session.user.email }]
          : [],
        username: session.user.name ?? null,
        imageUrl: session.user.image ?? null,
        firstName: nameParts[0] ?? null,
        lastName: nameParts.slice(1).join(' ') || null,
        createdAt: null,
        publicMetadata: {
          roles: entra?.roles ?? [],
          role: entra?.roles?.[0] ?? undefined,
          nzilaRole: entra?.roles?.find(r => r.startsWith('nzila.')) ?? undefined,
          zongaRole: entra?.roles?.find(r => r.startsWith('zonga.')) ?? undefined,
          agriRole: entra?.roles?.find(r => r.startsWith('agri.')) ?? undefined,
        },
        privateMetadata: {
          role: entra?.roles?.[0] ?? undefined,
          tenantId: entra?.tenantId ?? entra?.activeOrgId ?? undefined,
          organizationId: entra?.activeOrgId ?? undefined,
          identityProvider: entra?.identityProvider ?? undefined,
          isExternalUser: entra?.isExternalUser ?? false,
        },
        organizationMemberships: entra?.activeOrgId
          ? [{ organization: { id: entra.activeOrgId }, role: entra?.orgRole ?? 'member' }]
          : [],
      },
    }
  }

  // PG session fallback
  if (pgUser) {
    const fullName = [pgUser.firstName, pgUser.lastName].filter(Boolean).join(' ') || null
    return {
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: pgUser.id,
        fullName,
        primaryEmailAddress: pgUser.email ? { emailAddress: pgUser.email } : null,
        primaryPhoneNumber: null,
        emailAddresses: pgUser.email ? [{ emailAddress: pgUser.email }] : [],
        username: fullName,
        imageUrl: null,
        firstName: pgUser.firstName,
        lastName: pgUser.lastName,
        createdAt: null,
        publicMetadata: {},
        privateMetadata: {
          organizationId: pgUser.organizationId ?? undefined,
        },
        organizationMemberships: pgUser.organizationId
          ? [{ organization: { id: pgUser.organizationId }, role: 'member' }]
          : [],
      },
    }
  }

  // Still loading
  return {
    isLoaded: status !== 'loading' && pgLoaded,
    isSignedIn: false,
    user: null,
  }
}

// ── useOrganization() Hook ──────────────────────────────────────────────────

export interface OrgState {
  /** Whether org data has loaded. */
  isLoaded: boolean
  /** Active organization (null if none selected). */
  organization: {
    id: string
    name: string
    slug: string
  } | null
  /** Current user's membership in the active org. */
  membership: {
    role: string
  } | null
}

/**
 * Client-side organization hook — replaces Clerk's `useOrganization()`.
 * Falls back to PG session for password-based auth.
 */
export function useOrganization(): OrgState {
  const { data: session, status } = useSession()
  const entra = session as EntraSession | null
  const { pgUser, pgLoaded } = usePgSession(status)

  // NextAuth/Entra session
  if (status === 'authenticated' && entra?.activeOrgId) {
    return {
      isLoaded: true,
      organization: {
        id: entra.activeOrgId,
        name: '', // Populated from DB lookup in org context provider
        slug: '',
      },
      membership: entra.orgRole ? { role: entra.orgRole } : null,
    }
  }

  // PG session fallback
  if (pgUser?.organizationId) {
    return {
      isLoaded: true,
      organization: {
        id: pgUser.organizationId,
        name: '',
        slug: '',
      },
      membership: null,
    }
  }

  return {
    isLoaded: status !== 'loading' && pgLoaded,
    organization: null,
    membership: null,
  }
}

// ── useClerk() Compat Hook ──────────────────────────────────────────────────

/**
 * Clerk-compatible `useClerk()` — provides sign-out and user management.
 * Direct drop-in for `import { useClerk } from '@clerk/nextjs'`.
 */
export function useClerk() {
  return {
    signOut: async (callbackUrl?: string) => {
      await nextAuthSignOut({ redirectTo: callbackUrl ?? '/' })
    },
    openUserProfile: () => {
      // Entra doesn't have a hosted profile UI — navigate to settings
      window.location.href = '/dashboard/profile'
    },
    openSignIn: () => {
      window.location.href = '/sign-in'
    },
  }
}

// ── useSignUp() / useSignIn() Compat Hooks ──────────────────────────────────

/**
 * Clerk-compatible `useSignUp()` — Entra handles signup via the same OAuth flow.
 */
export function useSignUp() {
  return {
    isLoaded: true,
    signUp: {
      status: 'complete' as const,
      createdSessionId: null as string | null,
    },
    setActive: async (_params: { session: string | null }) => {
      // No-op: Entra handles session activation via the OAuth callback
    },
  }
}

// ── Sign-In / Sign-Out Actions ──────────────────────────────────────────────

/**
 * Trigger sign-in via Entra redirect.
 * Call this instead of navigating to Clerk's sign-in page.
 */
export async function signInWithEntra(callbackUrl?: string) {
  await nextAuthSignIn('microsoft-entra-id', {
    redirectTo: callbackUrl ?? '/dashboard',
  })
}

/**
 * Trigger sign-out.
 */
export async function signOutFromEntra(callbackUrl?: string) {
  await nextAuthSignOut({
    redirectTo: callbackUrl ?? '/',
  })
}

// ── Re-exports ──────────────────────────────────────────────────────────────

export { SessionProvider }
export { UserButton } from './components/user-button'
export { SignIn } from './components/sign-in'
export { SignUp } from './components/sign-up'
export { OrgSwitcher, OrgSwitcher as OrganizationSwitcher } from './components/org-switcher'
