/**
 * @nzila/platform-contracts — Org Scope Contracts
 *
 * Canonical org_scope model — the single multi-tenancy primitive
 * for all Nzila OS modules. Every protected resource is scoped
 * to an OrgScope.
 *
 * @invariant ORG_SCOPE_CANONICAL_001
 */
import { z } from 'zod'

// ── Org Scope ID (branded string) ───────────────────────────────────────────

/**
 * Opaque branded type for org scope identifiers.
 * Prevents accidental mixing of arbitrary strings with org IDs.
 */
export type OrgScopeId = string & { readonly __brand: 'OrgScopeId' }

/** Cast a validated string to OrgScopeId. Use only after validation. */
export function toOrgScopeId(id: string): OrgScopeId {
  return id as OrgScopeId
}

// ── Org Scope Status ────────────────────────────────────────────────────────

export const orgScopeStatusValues = [
  'active',
  'suspended',
  'deactivated',
  'pending_setup',
] as const

export type OrgScopeStatus = (typeof orgScopeStatusValues)[number]

// ── Org Scope ───────────────────────────────────────────────────────────────

export const orgScopeSchema = z.object({
  /** Unique org identifier (auth org ID or internal UUID). */
  id: z.string().min(1),
  /** Human-readable org name. */
  name: z.string().min(1),
  /** URL-safe slug. */
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  /** Current lifecycle status. */
  status: z.enum(orgScopeStatusValues),
  /** ISO-8601 creation timestamp. */
  createdAt: z.string().datetime(),
  /** Optional metadata bag for extensions. */
  metadata: z.record(z.unknown()).optional(),
})

export type OrgScope = z.infer<typeof orgScopeSchema>

// ── Org Scope Membership ────────────────────────────────────────────────────

export const orgScopeMembershipSchema = z.object({
  /** User ID. */
  userId: z.string().min(1),
  /** Org scope ID. */
  orgId: z.string().min(1),
  /** Role within the org. */
  role: z.string().min(1),
  /** Membership status. */
  status: z.enum(['active', 'suspended', 'removed']),
  /** When the membership was created. */
  joinedAt: z.string().datetime(),
})

export type OrgScopeMembership = z.infer<typeof orgScopeMembershipSchema>

// ── Org Scope Role Assignment ───────────────────────────────────────────────

export const orgScopeRoleAssignmentSchema = z.object({
  /** User ID receiving the role. */
  userId: z.string().min(1),
  /** Org scope ID. */
  orgId: z.string().min(1),
  /** Role being assigned. */
  role: z.string().min(1),
  /** Who assigned this role. */
  assignedBy: z.string().min(1),
  /** When the role was assigned. */
  assignedAt: z.string().datetime(),
  /** Optional expiration. */
  expiresAt: z.string().datetime().optional(),
})

export type OrgScopeRoleAssignment = z.infer<typeof orgScopeRoleAssignmentSchema>

// ── Org-Scoped Actor Context ────────────────────────────────────────────────

export const orgScopedActorContextSchema = z.object({
  /** Org scope ID — the tenant boundary. */
  orgId: z.string().min(1),
  /** Authenticated actor ID. */
  actorId: z.string().min(1),
  /** App originating the request. */
  appId: z.string().optional(),
  /** Actor's role within the org. */
  role: z.string().min(1),
  /** Granular permission keys. */
  permissions: z.array(z.string()),
  /** Request correlation ID. */
  requestId: z.string().min(1),
  /** Parent correlation ID for saga tracking. */
  correlationId: z.string().optional(),
})

export type OrgScopedActorContext = z.infer<typeof orgScopedActorContextSchema>

// ── Org-Scoped Request Context ──────────────────────────────────────────────

export const orgScopedRequestContextSchema = orgScopedActorContextSchema.extend({
  /** Request timestamp. */
  timestamp: z.string().datetime(),
  /** Source module/app. */
  moduleId: z.string().min(1),
  /** IP address (for audit, never for auth decisions). */
  clientIp: z.string().optional(),
  /** User-agent (for audit). */
  userAgent: z.string().optional(),
})

export type OrgScopedRequestContext = z.infer<typeof orgScopedRequestContextSchema>
