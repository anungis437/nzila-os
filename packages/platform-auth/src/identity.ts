/**
 * @nzila/platform-auth — Identity Types & Helpers
 *
 * Canonical identity shapes for authenticated users/sessions
 * across all Nzila OS modules. Wraps auth provider specifics
 * behind stable platform types.
 */
import { z } from 'zod'
import type { OrgContext } from '@nzila/org'

// ── Auth Status ─────────────────────────────────────────────────────────────

export type AuthStatus = 'authenticated' | 'unauthenticated' | 'service'

// ── Authenticated Identity ──────────────────────────────────────────────────

export const authenticatedIdentitySchema = z.object({
  /** User ID from auth provider. */
  userId: z.string().min(1),
  /** Primary email. */
  email: z.string().email().optional(),
  /** Display name. */
  displayName: z.string().optional(),
  /** Avatar URL. */
  avatarUrl: z.string().url().optional(),
  /** Active org ID from auth provider. */
  activeOrgId: z.string().optional(),
  /** Org role from auth provider. */
  orgRole: z.string().optional(),
  /** Session claims. */
  sessionClaims: z.record(z.unknown()).optional(),
  /** Whether this is a service account. */
  isService: z.boolean().default(false),
})

export type AuthenticatedIdentity = z.infer<typeof authenticatedIdentitySchema>

// ── Org Membership (from DB) ────────────────────────────────────────────────

export interface OrgMembership {
  id: string
  orgId: string
  userId: string
  role: 'org_admin' | 'org_secretary' | 'org_viewer'
  status: 'active' | 'suspended' | 'removed'
}

// ── Auth Result ─────────────────────────────────────────────────────────────

export interface AuthSuccess {
  ok: true
  identity: AuthenticatedIdentity
}

export interface AuthFailure {
  ok: false
  code: 'AUTH_REQUIRED' | 'ORG_SCOPE_REQUIRED' | 'ACCESS_DENIED'
  message: string
  httpStatus: number
}

export type AuthResult = AuthSuccess | AuthFailure

// ── Org-Scoped Auth Result ──────────────────────────────────────────────────

export interface OrgScopedAuthSuccess {
  ok: true
  identity: AuthenticatedIdentity
  orgContext: OrgContext
  membership: OrgMembership | null
}

export type OrgScopedAuthResult = OrgScopedAuthSuccess | AuthFailure

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build user initials from display name. */
export function getInitials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
}
