/**
 * Standardized Authentication Middleware
 * 
 * Provides:
 * - Consistent authentication enforcement across all routes
 * - Type-safe user context
 * - Role-based access control
 * - Audit logging of authentication attempts
 * 
 * Usage:
 *   import { requireAuth, requireRole, withAuth } from '@/lib/middleware/auth-middleware';
 *   
 *   export async function POST(request: Request) {
 *     const user = await requireAuth(request);
 *     if (!user.success) {
 *       return user.error;
 *     }
 *     // user.data contains authenticated user info
 *   }
 */

import { NextResponse } from 'next/server';
import type { Session } from '@clerk/nextjs/server';

// Dynamically import auth to handle different Clerk versions
let getAuthSession: (() => Promise<Session | null>) | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const clerkAuth = require('@clerk/nextjs/server');
  getAuthSession = clerkAuth.auth;
} catch {
}

/**
 * Authenticated user context
 */
export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  roles: string[];
  organizationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Authentication result type
 */
export type AuthResult<T = AuthenticatedUser> =
  | { success: true; data: T }
  | { success: false; error: NextResponse };

/**
 * Role definition
 */
export interface RoleDefinition {
  name: string;
  permissions: string[];
  description: string;
}

/**
 * Supported roles in the application
 */
export const SUPPORTED_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
  OFFICER: 'officer',
  TREASURER: 'treasurer',
  AUDITOR: 'auditor',
  DELEGATE: 'delegate',
  VIEWER: 'viewer',
} as const;

export type SupportedRole = typeof SUPPORTED_ROLES[keyof typeof SUPPORTED_ROLES];

/**
 * Role-based permission matrix
 */
export const ROLE_PERMISSIONS: Record<SupportedRole, string[]> = {
  [SUPPORTED_ROLES.ADMIN]: [
    'create:organization',
    'read:organization',
    'update:organization',
    'delete:organization',
    'manage:members',
    'manage:roles',
    'view:reports',
    'create:voting',
    'manage:voting',
    'manage:audit_logs',
  ],
  [SUPPORTED_ROLES.OFFICER]: [
    'read:organization',
    'create:voting',
    'manage:voting',
    'view:reports',
    'manage:members',
  ],
  [SUPPORTED_ROLES.TREASURER]: [
    'read:organization',
    'view:reports',
    'view:finances',
    'create:reports',
    'approve:payments',
  ],
  [SUPPORTED_ROLES.AUDITOR]: [
    'read:organization',
    'view:reports',
    'view:audit_logs',
    'view:finances',
  ],
  [SUPPORTED_ROLES.MEMBER]: [
    'read:organization',
    'participate:voting',
    'submit:claims',
    'view:profile',
  ],
  [SUPPORTED_ROLES.DELEGATE]: [
    'read:organization',
    'participate:voting',
    'vote:proxy',
  ],
  [SUPPORTED_ROLES.VIEWER]: [
    'read:organization',
  ],
};

/**
 * Authentication service
 */
export class AuthenticationService {
  /**
   * Get current authenticated user from Clerk
   */
  static async getCurrentUser(): Promise<AuthenticatedUser | null> {
    try {
      if (!getAuthSession) {
return null;
      }

      const session = await getAuthSession();
      
      if (!session) {
        return null;
      }

      // Extract user information from session
      const userId = (session as unknown as Record<string, unknown>).userId as string | undefined;
      if (!userId) {
        return null;
      }

      // Get user details from session
      const sessionData = session as unknown as Record<string, unknown>;
      
      // Extract user roles from Clerk metadata
      const publicMetadata = sessionData?.publicMetadata as Record<string, unknown> | undefined;
      const roles = (publicMetadata?.roles as string[]) || ['member'];
      const organizationId = (publicMetadata?.organizationId as string) || '';

      return {
        id: userId,
        email: ((sessionData?.emailAddresses as Array<{ emailAddress: string }> | undefined)?.[0]?.emailAddress) || null,
        firstName: (sessionData?.firstName as string) || null,
        lastName: (sessionData?.lastName as string) || null,
        roles,
        organizationId,
        metadata: publicMetadata as Record<string, unknown>,
      };
    } catch (_error) {
return null;
    }
  }

  /**
   * Validate user has required role
   */
  static hasRole(user: AuthenticatedUser, requiredRole: SupportedRole): boolean {
    return user.roles.includes(requiredRole);
  }

  /**
   * Validate user has required permission
   */
  static hasPermission(user: AuthenticatedUser, requiredPermission: string): boolean {
    // Check if any of user's roles include the required permission
    return user.roles.some(role => {
      const permissions = ROLE_PERMISSIONS[role as SupportedRole] || [];
      return permissions.includes(requiredPermission);
    });
  }

  /**
   * Check if user has at least one of multiple roles
   */
  static hasRoles(user: AuthenticatedUser, roles: SupportedRole[]): boolean {
    return roles.some(role => user.roles.includes(role));
  }

  /**
   * Check if user can access organization
   */
  static canAccessOrganization(user: AuthenticatedUser, organizationId: string): boolean {
    // Admins can access any organization
    if (user.roles.includes(SUPPORTED_ROLES.ADMIN)) {
      return true;
    }

    // Check if user belongs to organization
    return user.organizationId === organizationId;
  }
}

/**
 * Audit logging for authentication events
 */
class AuthenticationAuditLog {
  private static auditEvents: Array<{
    timestamp: Date;
    userId?: string;
    eventType: 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'PERMISSION_DENIED' | 'INVALID_TOKEN';
    endpoint?: string;
    reason?: string;
  }> = [];

  static log(event: {
    userId?: string;
    eventType: 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'PERMISSION_DENIED' | 'INVALID_TOKEN';
    endpoint?: string;
    reason?: string;
  }) {
    const auditEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.auditEvents.push(auditEvent);

    // Keep recent events only
    if (this.auditEvents.length > 10000) {
      this.auditEvents = this.auditEvents.slice(-10000);
    }

    // Log critical auth failures
    if (event.eventType === 'LOGIN_FAILED' || event.eventType === 'INVALID_TOKEN') {
}
  }

  static getEvents(filter?: { userId?: string; eventType?: string }) {
    let filtered = this.auditEvents;

    if (filter?.userId) {
      filtered = filtered.filter(e => e.userId === filter.userId);
    }

    if (filter?.eventType) {
      filtered = filtered.filter(e => e.eventType === filter.eventType);
    }

    return filtered;
  }

  static getStats() {
    const failedLogins = this.auditEvents.filter(e => e.eventType === 'LOGIN_FAILED').length;
    const successfulLogins = this.auditEvents.filter(e => e.eventType === 'LOGIN').length;
    const deniedPermissions = this.auditEvents.filter(e => e.eventType === 'PERMISSION_DENIED').length;

    return {
      totalAuthEvents: this.auditEvents.length,
      successfulLogins,
      failedLogins,
      failureRate: successfulLogins + failedLogins > 0
        ? ((failedLogins / (successfulLogins + failedLogins)) * 100).toFixed(2)
        : '0',
      deniedPermissions,
    };
  }
}

export { AuthenticationAuditLog };

/**
 * Require authentication on route
 * 
 * Usage:
 *   export async function POST(request: Request) {
 *     const auth = await requireAuth(request);
 *     if (!auth.success) return auth.error;
 *     // auth.data contains user
 *   }
 */
export async function requireAuth(): Promise<AuthResult> {
  const user = await AuthenticationService.getCurrentUser();

  if (!user) {
    AuthenticationAuditLog.log({
      eventType: 'LOGIN_FAILED',
      reason: 'User not authenticated',
    });

    return {
      success: false,
      error: NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      ),
    };
  }

  AuthenticationAuditLog.log({
    userId: user.id,
    eventType: 'LOGIN',
  });

  return { success: true, data: user };
}

/**
 * Require specific role
 * 
 * Usage:
 *   const auth = await requireRole(SUPPORTED_ROLES.ADMIN);
 */
export async function requireRole(role: SupportedRole): Promise<AuthResult> {
  const authResult = await requireAuth();

  if (!authResult.success) {
    return authResult;
  }

  if (!AuthenticationService.hasRole(authResult.data, role)) {
    AuthenticationAuditLog.log({
      userId: authResult.data.id,
      eventType: 'PERMISSION_DENIED',
      reason: `Required role: ${role}`,
    });

    return {
      success: false,
      error: NextResponse.json(
        { error: `Forbidden - ${role} role required` },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

/**
 * Require specific permission
 * 
 * Usage:
 *   const auth = await requirePermission('create:voting');
 */
export async function requirePermission(permission: string): Promise<AuthResult> {
  const authResult = await requireAuth();

  if (!authResult.success) {
    return authResult;
  }

  if (!AuthenticationService.hasPermission(authResult.data, permission)) {
    AuthenticationAuditLog.log({
      userId: authResult.data.id,
      eventType: 'PERMISSION_DENIED',
      reason: `Required permission: ${permission}`,
    });

    return {
      success: false,
      error: NextResponse.json(
        { error: `Forbidden - ${permission} permission required` },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

/**
 * Require access to specific organization
 * 
 * Usage:
 *   const auth = await requireOrganizationAccess(orgId);
 */
export async function requireOrganizationAccess(organizationId: string): Promise<AuthResult> {
  const authResult = await requireAuth();

  if (!authResult.success) {
    return authResult;
  }

  if (!AuthenticationService.canAccessOrganization(authResult.data, organizationId)) {
    AuthenticationAuditLog.log({
      userId: authResult.data.id,
      eventType: 'PERMISSION_DENIED',
      reason: `Organization access denied: ${organizationId}`,
    });

    return {
      success: false,
      error: NextResponse.json(
        { error: 'Forbidden - no access to this organization' },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

/**
 * Wrap async route handler with authentication
 * 
 * Usage:
 *   const POST = withAuth(async (request, user) => {
 *     // handler implementation with authenticated user
 *   });
 */
export function withAuth(
  handler: (request: Request, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return async (request: Request) => {
    const authResult = await requireAuth();

    if (!authResult.success) {
      return authResult.error;
    }

    return handler(request, authResult.data);
  };
}

/**
 * Wrap with role requirement
 */
export function withRole(
  role: SupportedRole,
  handler: (request: Request, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return async (request: Request) => {
    const authResult = await requireRole(role);

    if (!authResult.success) {
      return authResult.error;
    }

    return handler(request, authResult.data);
  };
}

/**
 * Wrap with permission requirement
 */
export function withPermission(
  permission: string,
  handler: (request: Request, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return async (request: Request) => {
    const authResult = await requirePermission(permission);

    if (!authResult.success) {
      return authResult.error;
    }

    return handler(request, authResult.data);
  };
}

/**
 * Extract bearer token from request
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7);
}

/**
 * Validate bearer token format
 */
export function isValidBearerToken(token: string): boolean {
  // Basic validation - token should be non-empty and contain valid characters
  return /^[A-Za-z0-9._-]+$/.test(token) && token.length >= 20;
}

