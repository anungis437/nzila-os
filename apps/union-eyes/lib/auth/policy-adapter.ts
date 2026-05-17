/**
 * Policy Engine Adapter  — @nzila/os-core/policy integration
 *
 * CONSTRAINT (INV-04): All API routes MUST call `authorize()` from
 * `@nzila/os-core/policy`.  This adapter maps the existing UE role
 * system (auth provider metadata + DB) to the os-core UERole enum, then
 * delegates to the centralised `authorize()` function.
 *
 * Existing code can continue to use `requireAuth()` / `requirePermission()`
 * from `rbac-server.ts` — those now delegate through this adapter.
 *
 * Usage in API routes:
 *   import { authorizeRoute, withAuthorizedRoute } from '@/lib/auth/policy-adapter'
 *
 *   // Option A: manual call
 *   export async function GET(req: NextRequest) {
 *     const ctx = await authorizeRoute(req)
 *     ...
 *   }
 *
 *   // Option B: wrapper (catches AuthorizationError → 403)
 *   export const GET = withAuthorizedRoute(
 *     { requiredRole: UERole.ANALYST },
 *     async (req, ctx) => { ... },
 *   )
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  authorize,
  withAuth,
  authorizeOrgAccess,
  type AuthContext,
  type AuthorizeOptions,
  AuthorizationError,
} from '@nzila/os-core/policy'
import { UERole } from '@nzila/os-core/policy'
import type { NzilaRole } from '@nzila/os-core/policy'
import { UserRole } from './roles'

// ---------------------------------------------------------------------------
// Role mapping: UE legacy UserRole → os-core UERole
// ---------------------------------------------------------------------------

const LEGACY_TO_OS_ROLE: Partial<Record<UserRole, NzilaRole>> = {
  // Leadership / admin roles → SUPERVISOR
  [UserRole.APP_OWNER]: UERole.SUPERVISOR,
  [UserRole.COO]: UERole.SUPERVISOR,
  [UserRole.CTO]: UERole.SUPERVISOR,
  [UserRole.PLATFORM_LEAD]: UERole.SUPERVISOR,
  [UserRole.SYSTEM_ADMIN]: UERole.SUPERVISOR,
  [UserRole.ADMIN]: UERole.SUPERVISOR,
  [UserRole.PRESIDENT]: UERole.SUPERVISOR,
  [UserRole.VICE_PRESIDENT]: UERole.SUPERVISOR,
  [UserRole.SECRETARY_TREASURER]: UERole.SUPERVISOR,
  [UserRole.SECURITY_MANAGER]: UERole.SUPERVISOR,
  [UserRole.COMPLIANCE_MANAGER]: UERole.SUPERVISOR,
  [UserRole.CUSTOMER_SUCCESS_DIRECTOR]: UERole.SUPERVISOR,

  // Case-working roles → CASE_MANAGER
  [UserRole.CHIEF_STEWARD]: UERole.CASE_MANAGER,
  [UserRole.OFFICER]: UERole.CASE_MANAGER,
  [UserRole.STEWARD]: UERole.CASE_MANAGER,
  [UserRole.BARGAINING_COMMITTEE]: UERole.CASE_MANAGER,
  [UserRole.HEALTH_SAFETY_REP]: UERole.CASE_MANAGER,
  [UserRole.SUPPORT_MANAGER]: UERole.CASE_MANAGER,
  [UserRole.SUPPORT_AGENT]: UERole.CASE_MANAGER,
  [UserRole.UNION_REP]: UERole.CASE_MANAGER,
  [UserRole.STAFF_REP]: UERole.CASE_MANAGER,

  // Analytics / data roles → ANALYST
  [UserRole.DATA_ANALYTICS_MANAGER]: UERole.ANALYST,
  [UserRole.DATA_ANALYST]: UERole.ANALYST,
  [UserRole.BILLING_MANAGER]: UERole.ANALYST,
  [UserRole.BILLING_SPECIALIST]: UERole.ANALYST,
  [UserRole.INTEGRATION_MANAGER]: UERole.ANALYST,
  [UserRole.INTEGRATION_SPECIALIST]: UERole.ANALYST,
  [UserRole.CONTENT_MANAGER]: UERole.ANALYST,
  [UserRole.TRAINING_COORDINATOR]: UERole.ANALYST,

  // Cross-org / congress / federation → ANALYST
  [UserRole.CLC_EXECUTIVE]: UERole.SUPERVISOR,
  [UserRole.CLC_STAFF]: UERole.ANALYST,
  [UserRole.CONGRESS_STAFF]: UERole.ANALYST,
  [UserRole.FED_EXECUTIVE]: UERole.SUPERVISOR,
  [UserRole.FED_STAFF]: UERole.ANALYST,
  [UserRole.FEDERATION_STAFF]: UERole.ANALYST,
  [UserRole.NATIONAL_OFFICER]: UERole.SUPERVISOR,

  // Base member → VIEWER
  [UserRole.MEMBER]: UERole.VIEWER,
  [UserRole.GUEST]: UERole.VIEWER,
}

/**
 * Map a legacy UE UserRole string to os-core NzilaRole.
 * Falls back to UERole.VIEWER (least privilege).
 */
export function mapToOsRole(legacyRole: UserRole | string): NzilaRole {
  return LEGACY_TO_OS_ROLE[legacyRole as UserRole] ?? UERole.VIEWER
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Authorise a request using the os-core policy engine.
 * Drop-in replacement for manual `auth()` + role checks inside API routes.
 */
export async function authorizeRoute(
  req: NextRequest | Request,
  options: AuthorizeOptions = {},
): Promise<AuthContext> {
  return authorize(req, options)
}

/**
 * Wrapper for Next.js route handlers.  Catches `AuthorizationError` and
 * returns a structured 401/403 JSON response.
 */
export function withAuthorizedRoute<T>(
  options: AuthorizeOptions,
  handler: (req: NextRequest, ctx: AuthContext) => Promise<NextResponse<T>>,
): (req: NextRequest) => Promise<NextResponse<T | { error: string }>> {
  return withAuth(options, handler)
}

/**
 * Check entity-level access (e.g., partner-portal isolation).
 */
export { authorizeOrgAccess, AuthorizationError }

// Re-export for convenience
export { UERole } from '@nzila/os-core/policy'
export type { AuthContext, AuthorizeOptions }

