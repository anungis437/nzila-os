/**
 * Enhanced RBAC Middleware for Enterprise Unions
 * 
 * @deprecated This module has been consolidated into @/lib/api-auth-guard
 * 
 * âš ï¸ DEPRECATION NOTICE âš ï¸
 * This file is being phased out. All enterprise RBAC features have been
 * consolidated into the canonical authentication module: @/lib/api-auth-guard
 * 
 * Migration Guide:
 * 
 * 1. withEnhancedRoleAuth() â†’ Use withEnhancedRoleAuth() from @/lib/api-auth-guard
 * 2. withPermission() â†’ Use withPermission() from @/lib/api-auth-guard
 * 3. withScopedRoleAuth() â†’ Use withScopedRoleAuth() from @/lib/api-auth-guard
 * 
 * Example migration:
 * ```typescript
 * // OLD
 * import { withEnhancedRoleAuth } from '@/lib/enterprise-role-middleware';
 * 
 * // NEW
 * import { withEnhancedRoleAuth } from '@/lib/api-auth-guard';
 * ```
 * 
 * All functionality remains identical. This is a simple import path change.
 * 
 * Features:
 * - Multi-role support (members can have multiple roles)
 * - Scope-based permissions (department, location, shift)
 * - Permission-based authorization (fine-grained control)
 * - Automatic audit logging
 * - Permission exceptions
 * - Term expiration checking
 * 
 * Usage:
 * ```typescript
 * // Require any active role at level 50+
 * export const GET = withEnhancedRoleAuth(50, async (request, context) => { ... });
 * 
 * // Require specific permission
 * export const POST = withPermission('create_claim', async (request, context) => { ... });
 * 
 * // Require role with scope matching
 * export const PATCH = withScopedRoleAuth('dept_steward', 'department', async (request, context) => { ... });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { withOrganizationAuth } from './organization-middleware';
import {
  getMemberRoles,
  getMemberHighestRoleLevel,
  getMemberEffectivePermissions,
  logPermissionCheck,
  incrementExceptionUsage,
  type MemberRoleWithDetails,
} from '@/db/queries/enhanced-rbac-queries';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Enhanced context with multi-role support and permissions
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
interface PermissionCheckResult {
  allowed: boolean;
  grantMethod?: 'role' | 'exception' | 'override';
  matchingRole?: MemberRoleWithDetails;
  denialReason?: string;
}

// ============================================================================
// CORE MIDDLEWARE
// ============================================================================

/**
 * Enhanced role-based authentication with multi-role support
 * 
 * @param minRoleLevel - Minimum role level required (e.g., 50 for steward)
 * @param handler - Request handler receiving enhanced context
 * @param options - Additional options (scope checking, audit config)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withEnhancedRoleAuth<T = any>(
  minRoleLevel: number,
  handler: (request: NextRequest, context: EnhancedRoleContext) => Promise<NextResponse<T>>,
  options: {
    scopeType?: string; // Required scope type (e.g., "department")
    scopeValue?: string; // Required scope value (e.g., "Manufacturing")
    allowGlobalScope?: boolean; // Allow global scope to bypass scope checks
    auditAction?: string; // Action name for audit log
    isSensitive?: boolean; // Flag as sensitive action
  } = {}
) {
  return withOrganizationAuth(async (request: NextRequest, orgContext: unknown) => {
    const startTime = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId } = orgContext as any;
    
    try {
      // Get member from context (requires tenant middleware to populate this)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memberId = (orgContext as any).memberId;
      if (!memberId) {
        await logAuditDenial(
          orgContext,
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
      
    } catch (_error) {
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
 * @param requiredPermission - Permission string (e.g., "create_claim", "approve_settlement")
 * @param handler - Request handler
 * @param options - Additional options
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withPermission<T = any>(
  requiredPermission: string,
  handler: (request: NextRequest, context: EnhancedRoleContext) => Promise<NextResponse<T>>,
  options: {
    resourceType?: string; // Resource type for permission exceptions
    resourceId?: string; // Specific resource ID for exceptions
    auditAction?: string; // Action name for audit log
    isSensitive?: boolean; // Flag as sensitive action
    allowExceptions?: boolean; // Allow permission exceptions (default: true)
  } = {}
) {
  return withOrganizationAuth(async (request: NextRequest, orgContext: unknown) => {
    const startTime = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId } = orgContext as any;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memberId = (orgContext as any).memberId;
      if (!memberId) {
        await logAuditDenial(
          { organizationId, userId, memberId: '' },
          options.auditAction || requiredPermission,
          options.resourceType || 'resource',
          'No member ID in context',
          Date.now() - startTime,
          options.isSensitive
        );
        return NextResponse.json(
          { error: 'Member not found.' },
          { status: 403 }
        );
      }
      
      // Load member data
      const roles = await getMemberRoles(memberId, organizationId);
      const highestRoleLevel = await getMemberHighestRoleLevel(memberId, organizationId);
      const permissions = await getMemberEffectivePermissions(memberId, organizationId);
      
      // Check permission
      const permissionCheck = await checkMemberPermission(
        memberId,
        organizationId,
        requiredPermission,
        permissions,
        options.resourceType,
        options.resourceId,
        options.allowExceptions !== false
      );
      
      if (!permissionCheck.allowed) {
        await logAuditDenial(
          { organizationId, userId, memberId },
          options.auditAction || requiredPermission,
          options.resourceType || 'resource',
          permissionCheck.denialReason || 'Permission denied',
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
        grantMethod: permissionCheck.grantMethod,
        executionTimeMs: Date.now() - startTime,
        isSensitive: options.isSensitive,
      });
      
      // Call handler
      return await handler(request, enhancedContext);
      
    } catch (_error) {
return NextResponse.json(
        { error: 'Authorization failed.' },
        { status: 500 }
      );
    }
  });
}

/**
 * Scoped role authentication (e.g., department steward accessing department resources)
 * 
 * @param roleCode - Required role code (e.g., "dept_steward")
 * @param scopeType - Required scope type (e.g., "department")
 * @param handler - Request handler
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withScopedRoleAuth<T = any>(
  roleCode: string,
  scopeType: string,
  handler: (request: NextRequest, context: EnhancedRoleContext) => Promise<NextResponse<T>>,
  options: {
    scopeValue?: string; // Specific scope value (if known at middleware level)
    allowGlobalScope?: boolean; // Allow global scope to bypass checks
    auditAction?: string;
    isSensitive?: boolean;
  } = {}
) {
  return withOrganizationAuth(async (request: NextRequest, orgContext: unknown) => {
    const startTime = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId } = orgContext as any;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memberId = (orgContext as any).memberId;
      if (!memberId) {
        await logAuditDenial(
          { organizationId, userId, memberId: '' },
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
      const matchingRoles = roles.filter(r => {
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
      
    } catch (_error) {
return NextResponse.json({ error: 'Authorization failed.' }, { status: 500 });
    }
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if member has required scope for their roles
 */
function checkMemberScope(
  roles: MemberRoleWithDetails[],
  requiredScopeType: string,
  requiredScopeValue?: string,
  allowGlobalScope: boolean = true
): ScopeCheckResult {
  const matchingRoles = roles.filter(role => {
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
      reason: `No role with scope: ${requiredScopeType}${requiredScopeValue ? `=${requiredScopeValue}` : ''}`,
    };
  }
  
  return {
    allowed: true,
    matchingRoles,
  };
}

/**
 * Get permission exception ID if one exists
 * Returns the exception ID or null if no valid exception found
 */
async function getPermissionExceptionId(
  memberId: string,
  organizationId: string,
  permission: string,
  resourceType?: string,
  resourceId?: string
): Promise<string | null> {
  try {
    const { sql } = await import('drizzle-orm');
    const { db } = await import('@/db/db');
    
    let query = sql`
      SELECT id FROM permission_exceptions
      WHERE member_id = ${memberId}
        AND organization_id = ${organizationId}
        AND permission = ${permission}
        AND is_active = TRUE
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (usage_limit IS NULL OR usage_count < usage_limit)
    `;
    
    if (resourceType) {
      query = sql`${query} AND resource_type = ${resourceType}`;
    }
    if (resourceId) {
      query = sql`${query} AND (resource_id IS NULL OR resource_id = ${resourceId})`;
    }
    
    query = sql`${query} LIMIT 1`;
    
    const result = await db.execute(query);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result as any[])[0]?.id || null;
  } catch (_error) {
return null;
  }
}

/**
 * Check if member has permission (via role or exception)
 */
async function checkMemberPermission(
  memberId: string,
  organizationId: string,
  requiredPermission: string,
  memberPermissions: string[],
  resourceType?: string,
  resourceId?: string,
  allowExceptions: boolean = true
): Promise<PermissionCheckResult> {
  // Check role permissions first
  if (memberPermissions.includes(requiredPermission) || memberPermissions.includes('*')) {
    return {
      allowed: true,
      grantMethod: 'role',
    };
  }
  
  // Check permission exceptions if allowed
  if (allowExceptions && resourceType) {
    // Check for exception first
    const exceptionId = await getPermissionExceptionId(
      memberId,
      organizationId,
      requiredPermission,
      resourceType,
      resourceId
    );
    
    if (exceptionId) {
      // Increment usage count for the exception
      try {
        await incrementExceptionUsage(exceptionId);
      } catch (_error) {
// Don&apos;t fail the request if usage tracking fails
      }
      
      return {
        allowed: true,
        grantMethod: 'exception',
      };
    }
  }
  
  return {
    allowed: false,
    denialReason: `Missing permission: ${requiredPermission}`,
  };
}

/**
 * Log denied access attempt
 */
async function logAuditDenial(
  context: unknown,
  action: string,
  resourceType: string,
  reason: string,
  executionTimeMs: number,
  isSensitive?: boolean
): Promise<void> {
  await logPermissionCheck({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actorId: (context as any).memberId || (context as any).userId || 'unknown',
    action,
    resourceType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    organizationId: (context as any).organizationId,
    granted: false,
    denialReason: reason,
    executionTimeMs,
    isSensitive: isSensitive || false,
  });
}

// ============================================================================
// CONTEXT HELPERS (for use inside handlers)
// ============================================================================

/**
 * Assert that user has specific permission (throw if not)
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
 */
export function getPrimaryRole(context: EnhancedRoleContext): MemberRoleWithDetails | null {
  if (context.roles.length === 0) return null;
  
  // Already sorted by role level DESC in query
  return context.roles[0];
}

/**
 * Get all roles for specific scope
 */
export function getRolesForScope(
  context: EnhancedRoleContext,
  scopeType: string,
  scopeValue?: string
): MemberRoleWithDetails[] {
  return context.roles.filter(role => {
    if (role.scopeType === 'global') return true;
    if (role.scopeType !== scopeType) return false;
    if (scopeValue && role.scopeValue !== scopeValue) return false;
    return true;
  });
}

