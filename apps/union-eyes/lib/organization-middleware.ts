/**
 * Organization Middleware
 * 
 * Middleware to enforce organization context in API routes.
 * Validates organization access and injects organization ID into request context.
 */

import { NextRequest, NextResponse } from "next/server";
import { getOrganizationIdForUser, validateOrganizationExists } from "@/lib/organization-utils";
import { requireUser, requireUserForOrganization } from "@/lib/api-auth-guard";
import { cookies } from "next/headers";

export interface OrganizationContext {
  organizationId: string;
  userId: string;
  memberId: string;
}

/**
 * Middleware to extract and validate organization context
 * 
 * Usage in API routes:
 * ```typescript
 * import { withOrganizationAuth } from "@/lib/organization-middleware";
 * 
 * export const GET = withOrganizationAuth(async (request, context) => {
 *   const { organizationId, userId } = context;
 *   // Your organization-aware logic here
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withOrganizationAuth<T = any>(
  handler: (
    request: NextRequest,
    context: OrganizationContext,
    params?: T
  ) => Promise<NextResponse> | NextResponse
) {
  return async (
    request: NextRequest,
    routeContext?: { params: Promise<T> | T }
  ): Promise<NextResponse> => {
    try {
      const baseUser = await requireUser();

      // Get organization ID - getOrganizationIdForUser handles cookie checking and access verification
      const organizationId = await getOrganizationIdForUser(baseUser.userId);
      const user = await requireUserForOrganization(organizationId, baseUser.userId);

      // Create organization context
      const context: OrganizationContext = {
        organizationId,
        userId: user.userId,
        memberId: user.memberId || '',
      };

      // Resolve params if they&apos;re a Promise
      const params = routeContext?.params 
        ? await Promise.resolve(routeContext.params)
        : undefined;

      // Call the handler with context
      return await handler(request, context, params);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      if (message === 'Unauthorized') {
        return NextResponse.json(
          { error: "Unauthorized - Authentication required" },
          { status: 401 }
        );
      }
      if (message === 'Forbidden') {
        return NextResponse.json(
          { error: "Forbidden - User is not a member of this organization" },
          { status: 403 }
        );
      }
return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Validate organization access for a specific organization ID
 * 
 * Use this when the organization ID comes from the request (e.g., URL parameter)
 * to ensure the user has access to that specific organization.
 */
export async function validateOrganizationAccess(
  userId: string,
  requestedOrganizationId: string
): Promise<boolean> {
  try {
    const _userOrganizationId = await getOrganizationIdForUser(userId);
    
    // Check if organization exists
    const exists = await validateOrganizationExists(requestedOrganizationId);
    
    if (!exists) {
      return false;
    }
    
    // For now, allow access if organization exists
    // In the future, implement hierarchical access checks
    // (e.g., federation admin can access all child unions/locals)
    
    return true;
  } catch (_error) {
return false;
  }
}

/**
 * Extract organization ID from request headers or cookies
 * 
 * Checks in order:
 * 1. X-Organization-ID header
 * 2. selected_organization_id cookie
 * 3. User's default organization
 */
export async function getOrganizationIdFromRequest(
  request: NextRequest,
  userId: string
): Promise<string> {
  // Check header first
  const headerOrgId = request.headers.get("X-Organization-ID");
  if (headerOrgId) {
    const isValid = await validateOrganizationExists(headerOrgId);
    if (isValid) {
      return headerOrgId;
    }
  }

  // Check cookie
  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get("selected_organization_id")?.value;
  if (cookieOrgId) {
    const isValid = await validateOrganizationExists(cookieOrgId);
    if (isValid) {
      return cookieOrgId;
    }
  }

  // Fall back to user's default organization
  return getOrganizationIdForUser(userId);
}

