/**
 * ABR trusted-source auth resolver — Phase 2C.6.
 *
 * Closes ROLE_SOURCE_TODO and TENANT_MEMBERSHIP_TODO by:
 *
 * 1. Verifying that the authenticated user belongs to the requested org.
 *    Sources (in priority order):
 *      a) Platform-auth session `orgId` matches the requested org.
 *      b) `abr_users` row where `id = userId AND org_id = orgId AND active = true`.
 *      c) Dev/test fallback (fails closed in production).
 *
 * 2. Deriving the ABR role from a server-side source.
 *    Sources (in priority order):
 *      a) Session `orgRole` when session `orgId` matches the requested org.
 *      b) `abr_users.role` from the verified membership row.
 *      c) `x-abr-role` header ONLY when both:
 *           - `NODE_ENV !== 'production'`
 *           - `ABR_ALLOW_HEADER_ROLE === 'true'`
 *         Never trusted in production.
 *
 * Trust contract:
 * - `x-org-id` is a selector (which org do I want to act in?).
 * - `x-org-id` is not proof of access.
 * - `x-abr-role` is dev/test-only. It cannot escalate privilege in production.
 */

import type { NextRequest } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { lookupAbrUserMembership } from '@/modules/auth/abr-user-lookup';
import { normalizeRole, type AbrRole } from '@/lib/rbac';

// ── Environment gates ─────────────────────────────────────────────────────────

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function isHeaderRoleAllowed(): boolean {
  return !isProduction() && process.env.ABR_ALLOW_HEADER_ROLE === 'true';
}

function isUnverifiedOrgAllowed(): boolean {
  return !isProduction() && process.env.ABR_ALLOW_UNVERIFIED_ORG === 'true';
}

function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// ── Membership verification ───────────────────────────────────────────────────

export type MembershipSource =
  | 'session_org_match'
  | 'abr_users_lookup'
  | 'in_memory_demo'
  | 'dev_unverified_fallback';

export interface MembershipResult {
  ok: true;
  role: AbrRole;
  source: MembershipSource;
}

export interface MembershipFailure {
  ok: false;
  reason: 'no_session' | 'no_membership' | 'user_inactive' | 'production_unverified_blocked';
}

/**
 * Verify that userId has active membership in orgId.
 * Returns the trusted role from the membership record on success.
 *
 * Sources checked in order:
 *   1. Session orgId match (trusted, no DB hit)
 *   2. abr_users table (DB mode)
 *   3. In-memory demo store (in-memory/pilot mode)
 *   4. Dev fallback (only if ABR_ALLOW_UNVERIFIED_ORG=true and not production)
 */
export async function verifyAbrOrgMembership(
  userId: string,
  orgId: string,
): Promise<MembershipResult | MembershipFailure> {
  // Source 1: session_org_match
  const session = await auth();
  if (session.userId && session.orgId === orgId && session.orgRole) {
    return {
      ok: true,
      role: normalizeRole(session.orgRole),
      source: 'session_org_match',
    };
  }

  // Source 2: abr_users lookup (DB mode)
  if (hasDatabase()) {
    const lookup = await lookupAbrUserMembership(userId, orgId);

    if (!lookup.found) return { ok: false, reason: 'no_membership' };
    if (!lookup.row.active) return { ok: false, reason: 'user_inactive' };

    return {
      ok: true,
      role: normalizeRole(lookup.row.role),
      source: 'abr_users_lookup',
    };
  }

  // Source 3: in-memory demo store
  const { listIncidentUsers } = await import('@/modules/incidents/service');
  const users = await listIncidentUsers(orgId);
  const member = users.find((u) => u.id === userId && u.active);
  if (member) {
    return {
      ok: true,
      role: normalizeRole(member.role),
      source: 'in_memory_demo',
    };
  }

  // Source 4: dev fallback — fails closed in production
  if (isUnverifiedOrgAllowed()) {
    return {
      ok: true,
      role: 'learner',
      source: 'dev_unverified_fallback',
    };
  }

  if (isProduction()) {
    return { ok: false, reason: 'production_unverified_blocked' };
  }

  return { ok: false, reason: 'no_membership' };
}

// ── Role resolution ───────────────────────────────────────────────────────────

export type RoleSource = MembershipSource | 'x_abr_role_dev_header';

export interface RoleResolution {
  role: AbrRole;
  source: RoleSource;
}

/**
 * Resolve the ABR role for a request against a verified membership.
 *
 * Membership must already be verified (call verifyAbrOrgMembership first).
 * The membership record carries the trusted role.
 *
 * `x-abr-role` header is honoured only when:
 *   - NODE_ENV !== 'production'
 *   - ABR_ALLOW_HEADER_ROLE === 'true'
 * In production, the membership role is always used.
 */
export function resolveAbrRoleForRequest(
  req: NextRequest | Request,
  membership: MembershipResult,
): RoleResolution {
  // Dev/test header override (never in production)
  if (isHeaderRoleAllowed()) {
    const headerRole = req.headers.get('x-abr-role');
    if (headerRole) {
      return { role: normalizeRole(headerRole), source: 'x_abr_role_dev_header' };
    }
  }

  return { role: membership.role, source: membership.source };
}
