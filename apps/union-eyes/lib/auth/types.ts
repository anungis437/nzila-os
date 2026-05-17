/**
 * Authentication & Authorization Types
 * Centralized type definitions for the auth system
 */

import type { UserRole, Permission } from './roles';

/**
 * User context returned from authentication
 */
export interface UserContext {
  userId: string;
  /** @deprecated Legacy field from previous auth provider era. Use userId (Entra subject / NextAuth sub) instead. */
  clerkId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  organizationId?: string | null;
}

/**
 * Organization context for multi-org operations
 */
export interface OrganizationContext extends UserContext {
  organizationId: string;
  organizationRole?: string;
  organizationPermissions?: string[];
}

/**
 * Auth validation result
 */
export interface AuthResult<T = UserContext> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * Permission check options
 */
export interface PermissionCheckOptions {
  userId: string;
  permission: Permission;
  organizationId?: string;
  resourceId?: string;
}

/**
 * Role check options
 */
export interface RoleCheckOptions {
  userId: string;
  role: UserRole | UserRole[];
  organizationId?: string;
}

/**
 * Auth middleware context
 */
export interface AuthMiddlewareContext {
  userId: string;
  sessionId?: string;
  organizationId?: string;
  role?: UserRole;
  permissions?: Permission[];
}

/**
 * Auth error types
 */
export enum AuthErrorType {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ORGANIZATION_REQUIRED = 'ORGANIZATION_REQUIRED',
  AUTH_PROVIDER_UNAVAILABLE = 'AUTH_PROVIDER_UNAVAILABLE',
}

/**
 * Auth error with detailed context
 */
export class AuthError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string,
    public statusCode: number = 401,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

