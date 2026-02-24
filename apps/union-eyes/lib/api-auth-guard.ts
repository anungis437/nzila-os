/**
 * Canonical Authentication Module
 * 
 * Single source of truth for all authentication patterns in the application.
 * This module consolidates all auth utilities into one cohesive API.
 * 
 * @module lib/api-auth-guard
 * 
 * =============================================================================
 * EXPORTS SUMMARY
 * =============================================================================
 * 
 * Guards (use these for API routes):
 * - withApiAuth()          - Wrapper pattern for route handlers (auth required)
 * - withApiAuthOptional()   - Wrapper pattern with optional auth
 * - withRoleAuth(role, handler)       - Wrapper for role-based access
 * - withMinRole(minRole, handler)      - Wrapper for minimum role hierarchy
 * 
 * User Utilities (get authenticated user data):
 * - getCurrentUser()     - Full user profile from Clerk
 * - getUserContext()     - User + org + roles + permissions from database
 * - getUserFromRequest() - Extract user from request context
 * 
 * Require Functions (throw on auth failure):
 * - requireUser()               - Require authenticated user
 * - requireUserForOrganization() - Require user with org membership
 * - requireRole()               - Require specific role
 * - requireSystemAdmin()        - Require system admin privileges
 * 
 * Role Utilities:
 * - hasRole()                   - Check if user has role
 * - hasMinRole()                - Check if user meets min role in hierarchy
 * - hasRoleInOrganization()     - Check org-specific role
 * - getUserRole()               - Get user's role in organization (returns role or null)
 * - normalizeRole()             - Normalize legacy roles
 * - isSystemAdmin()             - Check system admin status
 * 
 * Clerk Re-exports:
 * - auth()                      - Clerk's auth() function
 * - currentUser()               - Clerk's currentUser() function
 * 
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser as clerkCurrentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/db';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { organizationMembers } from '@/db/schema';
import { users } from '@/db/schema/domains/member';
import {
  getMemberRoles,
  getMemberHighestRoleLevel,
  getMemberEffectivePermissions,
  logPermissionCheck,
  type MemberRoleWithDetails,
} from '@/db/queries/enhanced-rbac-queries';
import { logger } from '@/lib/logger';

// =============================================================================
// CLERK RE-EXPORTS
// =============================================================================

export { auth, clerkCurrentUser as currentUser };

// =============================================================================
// TYPES
// =============================================================================

/**
 * Complete Role Hierarchy with App Operations & CLC Integration
 * Defines permission levels for all user roles in descending order of authority
 * Includes Nzila Ventures operations roles and cross-organizational hierarchy
 * 
 * Hierarchy Structure:
 * - App Operations (250-300): Nzila Ventures platform operations team
 * - System Administration (200-240): Technical operations across all orgs
 * - CLC National (180-190): Canadian Labour Congress executives and staff
 * - Federation (160-170): Provincial federation executives and staff
 * - National Union (150): National-level union officers
 * - Local Union Executives (85-100): Presidents, VPs, Treasurers, Admins
 * - Senior Representatives (60-70): Chief Stewards, Officers
 * - Front-line Representatives (40-50): Stewards, Bargaining Committee
 * - Specialized Representatives (30): Health & Safety
 * - Base Membership (10): Regular members
 */
export const ROLE_HIERARCHY = {
  // ========================================================
  // NZILA VENTURES - APP OPERATIONS (250-300)
  // Platform ownership and operations team
  // ========================================================
  
  // Strategic Leadership (290-300)
  app_owner: 300,                    // CEO - Strategic ownership & vision
  coo: 295,                          // COO - Overall platform operations
  cto: 290,                          // CTO - Technology leadership
  
  // Operational Leadership (260-280)
  platform_lead: 270,                // Platform Manager - Day-to-day operations
  customer_success_director: 260,    // Customer Success Director - Retention & growth
  
  // Department Managers (210-250)
  support_manager: 250,              // Support Manager - Help desk operations
  data_analytics_manager: 240,       // Analytics Manager - BI & reporting
  billing_manager: 230,              // Billing Manager - Subscriptions & payments
  integration_manager: 220,          // Integration Manager - APIs & partnerships
  compliance_manager: 210,           // Compliance Manager - Platform compliance
  security_manager: 200,             // Security Manager - Security operations
  
  // Operations Staff (150-190)
  support_agent: 180,                // Support Agent - Customer support
  data_analyst: 170,                 // Data Analyst - Analytics & reporting
  billing_specialist: 160,           // Billing Specialist - Billing operations
  integration_specialist: 150,       // Integration Specialist - API support
  
  // Content & Training (140-145)
  content_manager: 145,              // Content Manager - Resources & training
  training_coordinator: 140,         // Training Coordinator - User training
  
  // ========================================================
  // SYSTEM ADMINISTRATION (135)
  // Technical operations across all union organizations
  // ========================================================
  system_admin: 135,                 // System Admin - Technical operations
  
  // ========================================================
  // CLC NATIONAL (120-130) - Canadian Labour Congress
  // ========================================================
  clc_executive: 130,                // CLC President, Secretary-Treasurer
  clc_staff: 120,                    // CLC national staff
  
  // ========================================================
  // FEDERATION LEVEL (105-115) - Provincial Federations
  // ========================================================
  fed_executive: 115,                // Federation President, VP
  fed_staff: 105,                    // Provincial federation staff
  
  // ========================================================
  // UNION NATIONAL LEVEL (100)
  // ========================================================
  national_officer: 100,             // National union officers
  
  // ========================================================
  // LOCAL UNION EXECUTIVES (85-95)
  // ========================================================
  admin: 95,                         // Organization Administrator
  president: 90,                     // Union President
  vice_president: 85,                // Vice President
  secretary_treasurer: 85,           // Secretary-Treasurer
  
  // ========================================================
  // SENIOR REPRESENTATIVES (60-70)
  // ========================================================
  chief_steward: 70,                 // Chief Steward
  officer: 60,                       // Union Officer
  
  // ========================================================
  // FRONT-LINE REPRESENTATIVES (40-50)
  // ========================================================
  steward: 50,                       // Union Steward
  bargaining_committee: 40,          // Bargaining Committee Member
  
  // ========================================================
  // SPECIALIZED REPRESENTATIVES (30)
  // ========================================================
  health_safety_rep: 30,             // Health & Safety Representative
  
  // ========================================================
  // BASE MEMBERSHIP (10)
  // ========================================================
  member: 10,                        // Union Member
} as const;

export type UserRole = keyof typeof ROLE_HIERARCHY;

/**
 * Legacy role mappings for backward compatibility
 * Maps old role names to current role codes
 * Includes mappings for previous CLC implementation
 */
export const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  'super_admin': 'admin',
  'guest': 'member',
  'union_officer': 'officer',
  'union_steward': 'steward',
  'local_president': 'president',
  'dept_steward': 'steward',
  
  // CLC Legacy Mappings (from previous implementation)
  'congress_staff': 'clc_staff',          // CLC staff in old schema
  'federation_staff': 'fed_staff',        // Federation staff in old schema
  'congress_executive': 'clc_executive',  // CLC executives (if used)
  'system_administrator': 'system_admin', // System admin variants
} as const;

/**
 * Full user profile from Clerk
 */
export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  legacyTenantId: string | null; // Legacy tenant ID from Clerk user metadata (publicMetadata.tenantId / privateMetadata.tenantId)
  role: string | null;
  organizationId: string | null;
  metadata: Record<string, unknown>;
}

/**
 * User context with organization membership from database
 */
export interface UnifiedUserContext {
  userId: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
  memberId?: string;
}

/**
 * Enhanced context with multi-role support and permissions (Enterprise RBAC)
 * @consolidated from enterprise-role-middleware.ts
 */
export interface EnhancedRoleContext {
  organizationId: string;
  userId: string;
  memberId: string;
  roles: MemberRoleWithDetails[]; // All active roles
  highestRoleLevel: number; // Highest role level (for quick checks)
  permissions: string[]; // Merged permissions from all roles
  hasPermission: (permission: string) => boolean; // Check function
  checkScope: (scopeType: string, scopeValue: string) => boolean; // Scope check
}

/**
 * Scope check result
 */
interface ScopeCheckResult {
  allowed: boolean;
  matchingRoles: MemberRoleWithDetails[];
  reason?: string;
}

/**
 * Permission check result
 */
interface _PermissionCheckResult {
  allowed: boolean;
  grantMethod?: 'role' | 'exception' | 'override';
  matchingRole?: MemberRoleWithDetails;
  denialReason?: string;
}

/**
 * Base context type with common authentication fields
 */
export interface BaseAuthContext {
  [key: string]: unknown;
  params?: Record<string, unknown>;
  organizationId?: string;
  userId?: string;
  memberId?: string;
}

/**
 * API route handler type
 */
type ApiRouteHandler<TContext extends Record<string, unknown> = BaseAuthContext> = (
  request: NextRequest,
  context: TContext
) => Promise<NextResponse> | NextResponse;

/**
 * Options for requireApiAuth
 */
export interface RequireApiAuthOptions {
  /** Require organization context */
  tenant?: boolean;
  /** Require specific roles (any match) */
  roles?: string[];
  /** Allow public (unauthenticated) access */
  allowPublic?: boolean;
}

/**
 * Options for withApiAuth wrapper
 */
export interface ApiGuardOptions {
  /** Require authentication (default: true) */
  requireAuth?: boolean;
  /** For cron routes: validate cron secret header */
  cronAuth?: boolean;
  /** Minimum permission level required */
  minPermission?: string;
}

// =============================================================================
// PUBLIC & CRON ROUTES ALLOWLIST (PR #4: Single Source of Truth)
// =============================================================================
// 
// SECURITY: This is the ONLY place where public routes should be defined.
// Middleware.ts imports from here to ensure consistency.
//
// JUSTIFICATION REQUIRED: Every public route must have explicit documentation
// explaining WHY it bypasses authentication.
//
// PATTERN GUIDELINES:
// - Use exact paths (preferred): '/api/health'
// - Use path prefixes for route groups: '/api/webhooks/' (must end with /)
// - Minimize wildcards to reduce attack surface
// - Never use broad wildcards like '/api/*'
//

// =============================================================================
// PUBLIC & CRON ROUTE CONSTANTS - Re-exported from lib/public-routes.ts
// =============================================================================

/**
 * These route definitions are maintained in lib/public-routes.ts to avoid
 * pulling database imports into Edge runtime (middleware.ts).
 * 
 * We re-export here for backward compatibility with existing code that
 * imports these constants from api-auth-guard.ts.
 */
export { PUBLIC_API_ROUTES, CRON_API_ROUTES, isPublicRoute, isCronRoute } from './public-routes';
import { isPublicRoute, isCronRoute } from './public-routes';

/**
 * Verify cron secret header
 */
function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET_KEY;
  
  if (!expectedSecret) {
    logger.error('CRON_SECRET_KEY not configured', undefined, { context: 'Auth' });
    return false;
  }
  
  return cronSecret === expectedSecret;
}

// =============================================================================
// USER UTILITIES
// =============================================================================

/**
 * Get current authenticated user from Clerk
 * Primary auth function - returns full user profile
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return null;
    }

    const user = await clerkCurrentUser();
    
    if (!user) {
      return null;
    }

    const publicMetadata = user.publicMetadata || {};
    const privateMetadata = user.privateMetadata || {};
    const legacyTenantId =
      (publicMetadata.tenantId as string) || (privateMetadata.tenantId as string) || null;
    const metadataOrgId =
      (publicMetadata.organizationId as string) || (privateMetadata.organizationId as string) || null;
    const resolvedOrganizationId = orgId || metadataOrgId || legacyTenantId || null;

    return {
      id: userId,
      email: user.emailAddresses?.[0]?.emailAddress || null,
      name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      imageUrl: user.imageUrl || null,
      legacyTenantId,
      role: (publicMetadata.role as string) || (privateMetadata.role as string) || 'member',
      organizationId: resolvedOrganizationId,
      metadata: { ...publicMetadata },
    };
  } catch (error) {
    // SECURITY FIX: Fail closed - authentication system errors should not result in anonymous access
    // Log the error for monitoring but throw to reject the request with standardized error
    logger.error('CRITICAL: Authentication system error', error instanceof Error ? error : new Error(String(error)), { context: 'Auth' });
    
    // Throw standardized error (doesn&apos;t leak system details)
    const authError = new Error('Service temporarily unavailable');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (authError as any).statusCode = 503;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (authError as any).code = 'AUTH_SERVICE_ERROR';
    throw authError;
  }
}

/**
 * Get user from request context
 */
export async function getUserFromRequest(_request: NextRequest): Promise<AuthUser | null> {
  return getCurrentUser();
}

/**
 * Get permissions for a role
 */
function getPermissionsForRole(role: string): string[] {
  const permissions: Record<string, string[]> = {
    admin: ['*'],
    member: ['read:organization', 'submit:claims'],
    officer: ['manage:members', 'create:voting'],
    treasurer: ['view:finances', 'approve:payments'],
  };
  return permissions[role] || [];
}

/**
 * Get unified user context with organization membership from database
 */
export async function getUserContext(): Promise<UnifiedUserContext | null> {
  const { userId, orgId } = await auth();

  if (!userId) {
    return null;
  }

  let membership: Awaited<ReturnType<typeof db.query.organizationMembers.findFirst>> = undefined;

  if (orgId) {
    membership = await db.query.organizationMembers.findFirst({
      where: (om, { eq, and }) => and(eq(om.userId, userId), eq(om.organizationId, orgId)),
    });
  }

  if (!membership) {
    membership = await db.query.organizationMembers.findFirst({
      where: (om, { eq }) => eq(om.userId, userId),
    });
  }

  if (!membership) {
    return null;
  }

  const role = membership.role || 'member';

  return {
    userId,
    organizationId: membership.organizationId,
    roles: [role],
    permissions: getPermissionsForRole(role),
    memberId: membership.id,
  };
}

/**
 * Get user context for a specific organization
 */
export async function getUserContextForOrganization(
  organizationId: string,
  userIdOverride?: string
): Promise<UnifiedUserContext | null> {
  const userId = userIdOverride || (await auth()).userId;

  if (!userId) {
    return null;
  }

  const membership = await db.query.organizationMembers.findFirst({
    where: (om, { eq, and }) => and(eq(om.userId, userId), eq(om.organizationId, organizationId)),
  });

  if (!membership) {
    return null;
  }

  const role = membership.role || 'member';

  return {
    userId,
    organizationId: membership.organizationId,
    roles: [role],
    permissions: getPermissionsForRole(role),
    memberId: membership.id,
  };
}

// =============================================================================
// REQUIRE FUNCTIONS (throw on auth failure)
// =============================================================================

/**
 * Require authenticated user - throws if not authenticated
 */
export async function requireUser(): Promise<UnifiedUserContext> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const user = await getUserContext();
  if (!user) {
    throw new Error('Forbidden');
  }

  return user;
}

/**
 * Require user with organization membership - throws if not authorized
 */
export async function requireUserForOrganization(
  organizationId: string,
  userIdOverride?: string
): Promise<UnifiedUserContext> {
  const userId = userIdOverride || (await auth()).userId;

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const user = await getUserContextForOrganization(organizationId, userId);
  if (!user) {
    throw new Error('Forbidden');
  }

  return user;
}

/**
 * Require specific role - throws if user doesn&apos;t have role
 */
export async function requireRole(role: string): Promise<UnifiedUserContext> {
  const user = await requireUser();
  if (!user.roles.includes(role) && !user.roles.includes('admin')) {
    throw new Error(`Forbidden: Requires ${role} role`);
  }
  return user;
}

/**
 * Get user role from database
 */
async function getUserRoleFromDatabase(userId: string): Promise<string> {
  const membership = await db.query.organizationMembers.findFirst({
    where: (om, { eq }) => eq(om.userId, userId),
  });
  return membership?.role || 'member';
}

/**
 * Check if user is a system administrator
 */
export async function isSystemAdmin(userIdOverride?: string): Promise<boolean> {
  try {
    const userId = userIdOverride || (await auth()).userId;
    if (!userId) {
      return false;
    }

    const [user] = await db
      .select({ isSystemAdmin: users.isSystemAdmin })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    return user?.isSystemAdmin ?? false;
  } catch (error) {
    logger.error('[Auth] Error checking system admin status', error instanceof Error ? error : new Error(String(error)), { userId: userIdOverride });
    return false;
  }
}

/**
 * Require system admin - throws if not system admin
 */
export async function requireSystemAdmin(): Promise<void> {
  const isAdmin = await isSystemAdmin();
  
  if (!isAdmin) {
    throw new Error('System administrator privileges required');
  }
}

/**
 * Require API authentication with options
 */
export async function requireApiAuth(options: RequireApiAuthOptions = {}) {
  const { userId, orgId } = await auth();
  
  if (!userId && !options.allowPublic) {
    throw new Error('Unauthorized: Authentication required');
  }
  
  const context = {
    userId: userId || null,
    organizationId: options.tenant ? (orgId || null) : null,
    role: null as string | null,
  };
  
  // If roles are specified, verify user has one of them
  if (options.roles && options.roles.length > 0 && userId) {
    const userRole = await getUserRoleFromDatabase(userId);
    
    if (!options.roles.includes(userRole)) {
      throw new Error(`Forbidden: Requires one of roles: ${options.roles.join(', ')}`);
    }
    
    context.role = userRole;
  }
  
  return context;
}

// =============================================================================
// ROLE UTILITIES
// =============================================================================

/**
 * Normalize role string to aligned database enum value
 */
export function normalizeRole(role: string): UserRole {
  if (role in LEGACY_ROLE_MAP) {
    return LEGACY_ROLE_MAP[role as keyof typeof LEGACY_ROLE_MAP];
  }
  
  if (role in ROLE_HIERARCHY) {
    return role as UserRole;
  }
  
  return 'member';
}

/**
 * Check if user has specific role (uses hierarchy)
 */
export async function hasRole(requiredRole: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  
  const normalizedUserRole = normalizeRole(user.role || 'member');
  const normalizedRequiredRole = normalizeRole(requiredRole);
  
  const userRoleLevel = ROLE_HIERARCHY[normalizedUserRole] || 0;
  const requiredRoleLevel = ROLE_HIERARCHY[normalizedRequiredRole] || 0;
  
  return userRoleLevel >= requiredRoleLevel;
}

/**
 * Check if user has role in specific organization
 */
export async function hasRoleInOrganization(
  organizationId: string,
  requiredRole: string
): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    
    const membership = await db.query.organizationMembers.findFirst({
      where: (om, { eq, and }) => and(
        eq(om.userId, user.id),
        eq(om.organizationId, organizationId),
        eq(om.status, 'active')
      ),
      columns: { role: true },
    });
    
    if (!membership) return false;
    
    const normalizedUserRole = normalizeRole(membership.role);
    const normalizedRequiredRole = normalizeRole(requiredRole);
    
    const userRoleLevel = ROLE_HIERARCHY[normalizedUserRole] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[normalizedRequiredRole] || 0;
    
    return userRoleLevel >= requiredRoleLevel;
  } catch (error) {
    logger.error('[Auth] Error checking organization role', error instanceof Error ? error : new Error(String(error)), { organizationId });
    return false;
  }
}

/**
 * Get user's role in organization
 * Accepts either organization UUID or legacy tenant UUID
 * Returns the role or null if user is not a member
 * 
 * @param userId - User ID to check
 * @param organizationId - Organization ID (UUID or slug)
 * @returns User's role or null
 */
export async function getUserRole(
  userId: string,
  organizationId: string
): Promise<UserRole | null> {
  // With Clerk, org IDs are Clerk UUIDs directly — no legacy tenants table needed.
  // Delegate to hasRoleInOrganization which queries organizationMembers correctly.
  try {
    const membership = await db.query.organizationMembers.findFirst({
      where: (om, { eq, and }) => and(
        eq(om.userId, userId),
        eq(om.organizationId, organizationId),
        eq(om.status, 'active')
      ),
      columns: { role: true },
    });

    return (membership?.role as UserRole) || null;
  } catch (error) {
    logger.error('Failed to fetch user role', error instanceof Error ? error : new Error(String(error)), {
      userId,
      organizationId,
    });
    return null;
  }
}

/**
 * Check if user meets minimum role in hierarchy
 */
export async function hasMinRole(minRole: string): Promise<boolean> {
  return hasRole(minRole);
}

// =============================================================================
// API GUARD WRAPPER
// =============================================================================

/**
 * API Authentication Guard Wrapper with optional role requirement
 * 
 * Usage:
 * ```ts
 * import { withRoleAuth } from '@/lib/api-auth-guard';
 * 
 * // Require specific role:
 * export const POST = withRoleAuth('admin', async (request, context) => {
 *   // Your handler logic
 *   return NextResponse.json({ data });
 * });
 * 
 * // Require minimum role (uses hierarchy):
 * export const POST = withMinRole('officer', async (request, context) => {
 *   // Your handler logic
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withRoleAuth<TContext extends Record<string, unknown> = BaseAuthContext>(
  requiredRole: string,
  handler: ApiRouteHandler<TContext>
): ApiRouteHandler<TContext> {
  return withApiAuth(async (request: NextRequest, context: TContext) => {
    let user: AuthUser | null = null;
    try {
      user = await getCurrentUser();
    } catch (_error) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const hasAccess = await hasRole(requiredRole);
    if (!hasAccess) {
      return NextResponse.json(
        { error: `Forbidden: Requires ${requiredRole} role` },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
}

/**
 * API Guard Wrapper with minimum role hierarchy requirement
 * 
 * Hierarchy: admin > officer > steward > member
 * A user with 'officer' role can access routes requiring 'steward' or 'member'
 */
export function withMinRole<TContext extends Record<string, unknown> = BaseAuthContext>(
  minRole: string,
  handler: ApiRouteHandler<TContext>
): ApiRouteHandler<TContext> {
  return withApiAuth(async (request: NextRequest, context: TContext) => {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const hasAccess = await hasMinRole(minRole);
    if (!hasAccess) {
      return NextResponse.json(
        { error: `Forbidden: Requires minimum ${minRole} role` },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
}

/**
 * API Guard Wrapper for admin-only routes
 */
export function withAdminAuth<TContext extends Record<string, unknown> = BaseAuthContext>(
  handler: ApiRouteHandler<TContext>
): ApiRouteHandler<TContext> {
  return withRoleAuth('admin', handler);
}

/**
 * API Guard Wrapper for system admin routes
 */
export function withSystemAdminAuth<TContext extends Record<string, unknown> = BaseAuthContext>(
  handler: ApiRouteHandler<TContext>
): ApiRouteHandler<TContext> {
  return withApiAuth(async (request: NextRequest, context: TContext) => {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const isAdmin = await isSystemAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: System administrator privileges required' },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
}

// =============================================================================
// ENTERPRISE RBAC WRAPPERS (Consolidated from enterprise-role-middleware)
// =============================================================================

/**
 * Enhanced role-based authentication with multi-role support
 * 
 * @consolidated from enterprise-role-middleware.ts
 * 
 * @param minRoleLevel - Minimum role level required (e.g., 50 for steward)
 * @param handler - Request handler receiving enhanced context
 * @param options - Additional options (scope checking, audit config)
 * 
 * @example
 * ```typescript
 * // Require any active role at level 50+
 * export const GET = withEnhancedRoleAuth(50, async (request, context) => {
 *   const { roles, permissions, hasPermission, checkScope } = context;
 *   // Your handler logic with multi-role support
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withEnhancedRoleAuth<T = any>(
  minRoleLevel: number,
  handler: (request: NextRequest, context: EnhancedRoleContext) => Promise<NextResponse<T>>,
  options: {
    scopeType?: string;
    scopeValue?: string;
    allowGlobalScope?: boolean;
    auditAction?: string;
    isSensitive?: boolean;
  } = {}
) {
  return withApiAuth(async (request: NextRequest, _baseContext: unknown) => {
    const startTime = Date.now();
    const authResult = await auth();
    const userId = authResult?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    try {
      // Get member from context
      const userContext = await getUserContext();
      const organizationId = userContext?.organizationId;
      const memberId = userContext?.memberId;

      if (!memberId || !organizationId) {
        await logAuditDenial(
          { organizationId: organizationId || '', userId, memberId: '' },
          options.auditAction || 'access_resource',
          'member',
          'No member ID in context',
          Date.now() - startTime,
          options.isSensitive
        );
        return NextResponse.json(
          { error: 'Member not found. Ensure you are properly authenticated.' },
          { status: 403 }
        );
      }

      // Load member's roles and permissions
      const roles = await getMemberRoles(memberId, organizationId);
      const highestRoleLevel = await getMemberHighestRoleLevel(memberId, organizationId);
      const permissions = await getMemberEffectivePermissions(memberId, organizationId);

      // Check minimum role level
      if (highestRoleLevel < minRoleLevel) {
        await logAuditDenial(
          { organizationId, userId, memberId },
          options.auditAction || 'access_resource',
          'permission',
          `Insufficient role level: ${highestRoleLevel} < ${minRoleLevel}`,
          Date.now() - startTime,
          options.isSensitive
        );
        return NextResponse.json(
          { error: 'Insufficient permissions. Higher role required.' },
          { status: 403 }
        );
      }

      // Check scope if required
      if (options.scopeType) {
        const scopeCheck = checkMemberScope(
          roles,
          options.scopeType,
          options.scopeValue,
          options.allowGlobalScope !== false
        );

        if (!scopeCheck.allowed) {
          await logAuditDenial(
            { organizationId, userId, memberId },
            options.auditAction || 'access_resource',
            'scope',
            scopeCheck.reason || 'Scope mismatch',
            Date.now() - startTime,
            options.isSensitive
          );
          return NextResponse.json(
            { error: 'Access denied. Your role does not cover this scope.' },
            { status: 403 }
          );
        }
      }

      // Build enhanced context
      const enhancedContext: EnhancedRoleContext = {
        organizationId,
        userId,
        memberId,
        roles,
        highestRoleLevel,
        permissions,
        hasPermission: (permission: string) => {
          return permissions.includes(permission) || permissions.includes('*');
        },
        checkScope: (scopeType: string, scopeValue: string) => {
          return checkMemberScope(roles, scopeType, scopeValue, true).allowed;
        },
      };

      // Log successful access
      await logPermissionCheck({
        actorId: memberId,
        actorRole: roles[0]?.roleName,
        action: options.auditAction || 'access_resource',
        resourceType: 'api_endpoint',
        organizationId: organizationId,
        granted: true,
        grantMethod: 'role',
        executionTimeMs: Date.now() - startTime,
        isSensitive: options.isSensitive,
      });

      // Call handler with enhanced context
      return await handler(request, enhancedContext);
    } catch (error) {
      logger.error('Enhanced RBAC middleware error', { error });
      return NextResponse.json(
        { error: 'Authorization failed. Please try again.' },
        { status: 500 }
      );
    }
  });
}

/**
 * Permission-based authentication (fine-grained control)
 * 
 * @consolidated from enterprise-role-middleware.ts
 * 
 * @param requiredPermission - Permission string (e.g., "create_claim", "approve_settlement")
 * @param handler - Request handler
 * @param options - Additional options
 * 
 * @example
 * ```typescript
 * // Require specific permission
 * export const POST = withPermission('create_claim', async (request, context) => {
 *   // Handler logic - user has verified permission
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withPermission<T = any>(
  requiredPermission: string,
  handler: (request: NextRequest, context: EnhancedRoleContext) => Promise<NextResponse<T>>,
  options: {
    resourceType?: string;
    resourceId?: string;
    auditAction?: string;
    isSensitive?: boolean;
    allowExceptions?: boolean;
  } = {}
) {
  return withApiAuth(async (request: NextRequest, _baseContext: unknown) => {
    const startTime = Date.now();
    const authResult = await auth();
    const userId = authResult?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    try {
      const userContext = await getUserContext();
      const organizationId = userContext?.organizationId;
      const memberId = userContext?.memberId;

      if (!memberId || !organizationId) {
        await logAuditDenial(
          { organizationId: organizationId || '', userId, memberId: '' },
          options.auditAction || requiredPermission,
          options.resourceType || 'resource',
          'No member ID in context',
          Date.now() - startTime,
          options.isSensitive
        );
        return NextResponse.json({ error: 'Member not found.' }, { status: 403 });
      }

      // Load member data
      const roles = await getMemberRoles(memberId, organizationId);
      const highestRoleLevel = await getMemberHighestRoleLevel(memberId, organizationId);
      const permissions = await getMemberEffectivePermissions(memberId, organizationId);

      // Check permission
      const hasPermissionAccess =
        permissions.includes(requiredPermission) || permissions.includes('*');

      if (!hasPermissionAccess) {
        await logAuditDenial(
          { organizationId, userId, memberId },
          options.auditAction || requiredPermission,
          options.resourceType || 'resource',
          `Permission denied: ${requiredPermission}`,
          Date.now() - startTime,
          options.isSensitive
        );
        return NextResponse.json(
          { error: `Permission denied: ${requiredPermission}` },
          { status: 403 }
        );
      }

      // Build enhanced context
      const enhancedContext: EnhancedRoleContext = {
        organizationId,
        userId,
        memberId,
        roles,
        highestRoleLevel,
        permissions,
        hasPermission: (permission: string) => {
          return permissions.includes(permission) || permissions.includes('*');
        },
        checkScope: (scopeType: string, scopeValue: string) => {
          return checkMemberScope(roles, scopeType, scopeValue, true).allowed;
        },
      };

      // Log successful access
      await logPermissionCheck({
        actorId: memberId,
        actorRole: roles[0]?.roleName,
        action: options.auditAction || requiredPermission,
        resourceType: options.resourceType || 'resource',
        resourceId: options.resourceId,
        organizationId: organizationId,
        requiredPermission,
        granted: true,
        grantMethod: 'role',
        executionTimeMs: Date.now() - startTime,
        isSensitive: options.isSensitive,
      });

      // Call handler
      return await handler(request, enhancedContext);
    } catch (error) {
      logger.error('Permission middleware error', { error });
      return NextResponse.json({ error: 'Authorization failed.' }, { status: 500 });
    }
  });
}

/**
 * Scoped role authentication (e.g., department steward accessing department resources)
 * 
 * @consolidated from enterprise-role-middleware.ts
 * 
 * @param roleCode - Required role code (e.g., "dept_steward")
 * @param scopeType - Required scope type (e.g., "department")
 * @param handler - Request handler
 * 
 * @example
 * ```typescript
 * // Require department steward role with department scope
 * export const PATCH = withScopedRoleAuth('dept_steward', 'department', async (request, context) => {
 *   // Handler logic - user has role with proper scope
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withScopedRoleAuth<T = any>(
  roleCode: string,
  scopeType: string,
  handler: (request: NextRequest, context: EnhancedRoleContext) => Promise<NextResponse<T>>,
  options: {
    scopeValue?: string;
    allowGlobalScope?: boolean;
    auditAction?: string;
    isSensitive?: boolean;
  } = {}
) {
  return withApiAuth(async (request: NextRequest, _baseContext: unknown) => {
    const startTime = Date.now();
    const authResult = await auth();
    const userId = authResult?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    try {
      const userContext = await getUserContext();
      const organizationId = userContext?.organizationId;
      const memberId = userContext?.memberId;

      if (!memberId || !organizationId) {
        await logAuditDenial(
          { organizationId: organizationId || '', userId, memberId: '' },
          options.auditAction || `scoped_${roleCode}`,
          'role',
          'No member ID',
          Date.now() - startTime,
          options.isSensitive
        );
        return NextResponse.json({ error: 'Member not found.' }, { status: 403 });
      }

      // Load member roles
      const roles = await getMemberRoles(memberId, organizationId);
      const highestRoleLevel = await getMemberHighestRoleLevel(memberId, organizationId);
      const permissions = await getMemberEffectivePermissions(memberId, organizationId);

      // Find matching role with scope
      const matchingRoles = roles.filter((r) => {
        if (r.roleCode !== roleCode) return false;

        // Check scope
        if (options.allowGlobalScope && r.scopeType === 'global') return true;
        if (r.scopeType !== scopeType) return false;
        if (options.scopeValue && r.scopeValue !== options.scopeValue) return false;

        return true;
      });

      if (matchingRoles.length === 0) {
        await logAuditDenial(
          { organizationId, userId, memberId },
          options.auditAction || `scoped_${roleCode}`,
          'role',
          `No matching role: ${roleCode} with scope ${scopeType}`,
          Date.now() - startTime,
          options.isSensitive
        );
        return NextResponse.json(
          { error: `Required role with scope not found: ${roleCode} (${scopeType})` },
          { status: 403 }
        );
      }

      // Build context
      const enhancedContext: EnhancedRoleContext = {
        organizationId,
        userId,
        memberId,
        roles,
        highestRoleLevel,
        permissions,
        hasPermission: (permission: string) => {
          return permissions.includes(permission) || permissions.includes('*');
        },
        checkScope: (checkScopeType: string, checkScopeValue: string) => {
          return checkMemberScope(roles, checkScopeType, checkScopeValue, true).allowed;
        },
      };

      // Log success
      await logPermissionCheck({
        actorId: memberId,
        actorRole: matchingRoles[0].roleName,
        action: options.auditAction || `scoped_${roleCode}`,
        resourceType: 'scoped_resource',
        organizationId: organizationId,
        granted: true,
        grantMethod: 'role',
        executionTimeMs: Date.now() - startTime,
        isSensitive: options.isSensitive,
      });

      return await handler(request, enhancedContext);
    } catch (error) {
      logger.error('Scoped role middleware error', { error });
      return NextResponse.json({ error: 'Authorization failed.' }, { status: 500 });
    }
  });
}

/**
 * API Authentication Guard Wrapper
 * 
 * Usage:
 * ```ts
 * import { withApiAuth } from '@/lib/api-auth-guard';
 * 
 * export const GET = withApiAuth(async (request, context) => {
 *   // Your handler logic
 *   return NextResponse.json({ data });
 * });
 * 
 * // For cron routes:
 * export const POST = withApiAuth(async (request, context) => {
 *   // Your handler logic
 * }, { cronAuth: true });
 * 
 * // For public routes:
 * export const GET = withApiAuth(async (request, context) => {
 *   // Your handler logic
 * }, { requireAuth: false });
 * ```
 */
export function withApiAuth<TContext extends Record<string, unknown> = BaseAuthContext>(
  handler: ApiRouteHandler<TContext>,
  options: ApiGuardOptions = {}
): ApiRouteHandler<TContext> {
  return async (request: NextRequest, context: TContext) => {
    const pathname = request.nextUrl.pathname;
    
    const isPublic = isPublicRoute(pathname);
    const isCron = isCronRoute(pathname);
    
    const requireAuth = options.requireAuth !== false && !isPublic;
    const requireCronAuth = options.cronAuth || isCron;
    
    // Cron authentication
    if (requireCronAuth) {
      if (!verifyCronAuth(request)) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid cron secret' },
          { status: 401 }
        );
      }
      return handler(request, context);
    }
    
    // User authentication
    if (requireAuth) {
      try {
        const { userId } = await auth();
        
        if (!userId) {
          return NextResponse.json(
            { error: 'Unauthorized: Authentication required' },
            { status: 401 }
          );
        }
      } catch (error) {
        logger.error('[Auth] Guard check failed', { error });
        return NextResponse.json(
          { error: 'Authentication error' },
          { status: 401 }
        );
      }
    }
    
    return handler(request, context);
  };
}

// =============================================================================
// ENTERPRISE RBAC HELPER FUNCTIONS (Consolidated from enterprise-role-middleware)
// =============================================================================

/**
 * Check if member has required scope for their roles
 * @consolidated from enterprise-role-middleware.ts
 */
function checkMemberScope(
  roles: MemberRoleWithDetails[],
  requiredScopeType: string,
  requiredScopeValue?: string,
  allowGlobalScope: boolean = true
): ScopeCheckResult {
  const matchingRoles = roles.filter((role) => {
    // Global scope bypasses all checks
    if (allowGlobalScope && role.scopeType === 'global') {
      return true;
    }

    // Check scope type matches
    if (role.scopeType !== requiredScopeType) {
      return false;
    }

    // Check scope value if specified
    if (requiredScopeValue && role.scopeValue !== requiredScopeValue) {
      return false;
    }

    return true;
  });

  if (matchingRoles.length === 0) {
    return {
      allowed: false,
      matchingRoles: [],
      reason: `No role with scope: ${requiredScopeType}${
        requiredScopeValue ? `=${requiredScopeValue}` : ''
      }`,
    };
  }

  return {
    allowed: true,
    matchingRoles,
  };
}

/**
 * Log denied access attempt
 * @consolidated from enterprise-role-middleware.ts
 */
async function logAuditDenial(
  context: unknown,
  action: string,
  resourceType: string,
  reason: string,
  executionTimeMs: number,
  isSensitive?: boolean
): Promise<void> {
  const ctx = context as Record<string, unknown>;
  await logPermissionCheck({
    actorId: (ctx.memberId as string) || (ctx.userId as string) || 'unknown',
    action,
    resourceType,
    organizationId: ctx.organizationId as string,
    granted: false,
    denialReason: reason,
    executionTimeMs,
    isSensitive: isSensitive || false,
  });
}

/**
 * Assert that user has specific permission (throw if not)
 * Use inside handler functions to perform runtime permission checks
 * 
 * @consolidated from enterprise-role-middleware.ts
 * 
 * @example
 * ```typescript
 * export const POST = withEnhancedRoleAuth(50, async (request, context) => {
 *   await requirePermission(context, 'approve_claim', 'Claim approval permission required');
 *   // Continue with claim approval logic...
 * });
 * ```
 */
export async function requirePermission(
  context: EnhancedRoleContext,
  permission: string,
  errorMessage?: string
): Promise<void> {
  if (!context.hasPermission(permission)) {
    await logPermissionCheck({
      actorId: context.memberId,
      action: permission,
      resourceType: 'runtime_check',
      organizationId: context.organizationId,
      granted: false,
      denialReason: `Runtime permission check failed: ${permission}`,
    });

    throw new Error(errorMessage || `Permission required: ${permission}`);
  }
}

/**
 * Assert that user has role at minimum level (throw if not)
 * Use inside handler functions to perform runtime role level checks
 * 
 * @consolidated from enterprise-role-middleware.ts
 * 
 * @example
 * ```typescript
 * export const PATCH = withEnhancedRoleAuth(50, async (request, context) => {
 *   // Additional check for admin-only operations
 *   await requireRoleLevel(context, 100, 'Admin role required for this operation');
 *   // Continue with admin operation...
 * });
 * ```
 */
export async function requireRoleLevel(
  context: EnhancedRoleContext,
  minLevel: number,
  errorMessage?: string
): Promise<void> {
  if (context.highestRoleLevel < minLevel) {
    await logPermissionCheck({
      actorId: context.memberId,
      action: 'role_level_check',
      resourceType: 'runtime_check',
      organizationId: context.organizationId,
      granted: false,
      denialReason: `Insufficient role level: ${context.highestRoleLevel} < ${minLevel}`,
    });

    throw new Error(errorMessage || `Role level ${minLevel} required`);
  }
}

/**
 * Assert that user has scope (throw if not)
 * Use inside handler functions to perform runtime scope checks
 * 
 * @consolidated from enterprise-role-middleware.ts
 * 
 * @example
 * ```typescript
 * export const GET = withEnhancedRoleAuth(50, async (request, context) => {
 *   const departmentId = request.nextUrl.searchParams.get('department_id');
 *   requireScope(context, 'department', departmentId, 'Access to this department denied');
 *   // Continue with department-specific operations...
 * });
 * ```
 */
export function requireScope(
  context: EnhancedRoleContext,
  scopeType: string,
  scopeValue: string,
  errorMessage?: string
): void {
  if (!context.checkScope(scopeType, scopeValue)) {
    throw new Error(errorMessage || `Scope required: ${scopeType}=${scopeValue}`);
  }
}

/**
 * Check if context member can access resource owned by another member
 * (either they own it, or they have sufficient role level)
 * 
 * @consolidated from enterprise-role-middleware.ts
 * 
 * @example
 * ```typescript
 * export const GET = withEnhancedRoleAuth(40, async (request, context) => {
 *   const resourceOwnerId = await getResourceOwner(resourceId);
 *   
 *   if (!canAccessMemberResource(context, resourceOwnerId, 60)) {
 *     return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
 *   }
 *   // Continue...
 * });
 * ```
 */
export function canAccessMemberResource(
  context: EnhancedRoleContext,
  resourceOwnerId: string,
  minRoleLevelForOthers: number = 50 // Default: steward+ can access others
): boolean {
  // Own resource
  if (context.memberId === resourceOwnerId) {
    return true;
  }

  // Sufficient role level
  if (context.highestRoleLevel >= minRoleLevelForOthers) {
    return true;
  }

  return false;
}

/**
 * Get primary role (highest level) for display
 * 
 * @consolidated from enterprise-role-middleware.ts
 * 
 * @example
 * ```typescript
 * export const GET = withEnhancedRoleAuth(40, async (request, context) => {
 *   const primaryRole = getPrimaryRole(context);
 *   logger.info(`User's primary role: ${primaryRole?.roleName}`);
 * });
 * ```
 */
export function getPrimaryRole(context: EnhancedRoleContext): MemberRoleWithDetails | null {
  if (context.roles.length === 0) return null;

  // Already sorted by role level DESC in query
  return context.roles[0];
}

/**
 * Get all roles for specific scope
 * 
 * @consolidated from enterprise-role-middleware.ts
 * 
 * @example
 * ```typescript
 * export const GET = withEnhancedRoleAuth(40, async (request, context) => {
 *   const deptRoles = getRolesFor Scope(context, 'department', 'Manufacturing');
 *   logger.info(`User has ${deptRoles.length} roles in Manufacturing dept`);
 * });
 * ```
 */
export function getRolesForScope(
  context: EnhancedRoleContext,
  scopeType: string,
  scopeValue?: string
): MemberRoleWithDetails[] {
  return context.roles.filter((role) => {
    if (role.scopeType === 'global') return true;
    if (role.scopeType !== scopeType) return false;
    if (scopeValue && role.scopeValue !== scopeValue) return false;
    return true;
  });
}

// =============================================================================
// LEGACY COMPATIBILITY RE-EXPORTS
// =============================================================================

/**
 * @deprecated Use getCurrentUser() instead
 */
export async function getServerSession() {
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.imageUrl,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Require that the current user has at least the given role (by hierarchy level).
 *
 * Uses `getRoleLevel()` from roles.ts so that e.g.
 *   `await requireMinRole('platform_lead')` passes for app_owner, coo, cto, platform_lead
 *   but rejects support_agent, member, etc.
 */
export async function requireMinRole(minRole: string): Promise<UnifiedUserContext> {
  const user = await requireUser();
  const { getRoleLevel  } = await import('./auth/roles');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const minLevel = getRoleLevel(minRole as any);
  const userLevel = Math.max(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...user.roles.map((r: string) => getRoleLevel(r as any)),
    0,
  );
  if (userLevel < minLevel) {
    throw new Error(`Forbidden: Requires at least ${minRole} role (level ${minLevel})`);
  }
  return user;
}

/**
 * @deprecated Use requireUser() instead
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return user;
}

