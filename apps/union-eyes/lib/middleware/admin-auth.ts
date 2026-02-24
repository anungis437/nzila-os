/**
 * Admin Authentication Middleware
 * 
 * SPRINT 7: Authentication & Authorization
 * 
 * Protects `/admin/*` routes with role-based access control.
 * Ensures only users with 'admin' or 'super-admin' roles can access admin CMS.
 * 
 * Philosophy: "Explicit authorization, clear error messages, audit logging"
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { organizationMembers } from '@/db/schema/organization-members-schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import * as React from 'react';
import { GovernanceService } from '@/services/governance-service';

/**
 * Check if user has admin role
 * 
 * @param userId - Clerk user ID
 * @param organizationId - Organization ID (optional - checks across all orgs if not provided)
 * @returns True if user has admin or super-admin role
 */
export async function isUserAdmin(userId: string, organizationId?: string): Promise<boolean> {
  try {
    const query = organizationId
      ? and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.status, 'active')
        )
      : and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.status, 'active')
        );

    const memberships = await db
      .select()
      .from(organizationMembers)
      .where(query)
      .limit(10); // Check up to 10 memberships

    // User is admin if they have 'admin' or 'super-admin' role in any active membership
    const hasAdminRole = memberships.some(
      (m) => m.role === 'admin' || m.role === 'super-admin'
    );

    return hasAdminRole;
  } catch (error) {
    logger.error('Failed to check admin status', { error, userId, organizationId });
    return false; // Fail closed - deny access on error
  }
}

/**
 * Admin authentication middleware for API routes
 * 
 * Usage in API route:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const authResult = await requireAdmin(request);
 *   if (!authResult.authorized) {
 *     return authResult.response;
 *   }
 *   
 *   // Proceed with admin logic
 *   const { userId, organizationId } = authResult;
 *   ...
 * }
 * ```
 */
export async function requireAdmin(
  request: NextRequest
): Promise<
  | { authorized: true; userId: string; organizationId?: string }
  | { authorized: false; response: NextResponse }
> {
  try {
    // Get authentication from Clerk
    const { userId } = getAuth(request);

    if (!userId) {
      logger.warn('Unauthenticated admin access attempt', {
        url: request.url,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      });

      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Authentication required. Please log in.' },
          { status: 401 }
        ),
      };
    }

    // Check if user has admin role
    const hasAdminAccess = await isUserAdmin(userId);

    if (!hasAdminAccess) {
      logger.warn('Unauthorized admin access attempt', {
        userId,
        url: request.url,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      });

      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: 'Insufficient permissions. Admin access required.',
            requiredRole: 'admin',
          },
          { status: 403 }
        ),
      };
    }

    // Get user's primary organization (first active membership)
    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, 'active')))
      .limit(1);

    logger.info('Admin access granted', {
      userId,
      organizationId: membership?.organizationId,
      url: request.url,
    });

    return {
      authorized: true,
      userId,
      organizationId: membership?.organizationId,
    };
  } catch (error) {
    logger.error('Admin authentication error', {
      error,
      url: request.url,
    });

    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Authentication error. Please try again.' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Admin authentication HOC for pages
 * 
 * NOTE: This is a placeholder for future client-side protection.
 * For Server Components, use getAuth() from @clerk/nextjs/server directly.
 * For Client Components, use useAuth() from @clerk/nextjs in client components.
 * 
 * Usage concept (not implemented):
 * ```typescript
 * export default withAdminAuth(function AdminPage({ userId, organizationId }) {
 *   // Page logic
 * });
 * ```
 */
export function withAdminAuth<P extends Record<string, unknown>>(
  Component: React.ComponentType<P & { userId: string; organizationId?: string }>
): React.ComponentType<P> {
  // Type-only placeholder - actual implementation would require .tsx file
  return Component as unknown as React.ComponentType<P>;
}

/**
 * Check if user has golden share privileges
 * 
 * Golden share holders have special permissions:
 * - Can revoke data sharing consent (sovereignty protection)
 * - Can approve/reject pilot applications
 * - Can override certain admin decisions
 * 
 * @param userId - User ID to check
 * @param organizationId - Organization ID
 * @returns True if user holds golden share
 */
export async function hasGoldenSharePrivileges(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const governanceService = new GovernanceService();
    const status = await governanceService.checkGoldenShareStatus();

    if (!status?.share || status.share.status !== 'active') {
      return false;
    }

    // Golden share privileges are restricted to admins until council membership mapping is added.
    return await isUserAdmin(userId, organizationId);
  } catch (error) {
    logger.error('Failed to check golden share status', { error, userId, organizationId });
    return false;
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  isUserAdmin,
  requireAdmin,
  withAdminAuth,
  hasGoldenSharePrivileges,
};
