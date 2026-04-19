/**
 * Organization Middleware
 * 
 * Middleware to enforce organization context in API routes.
 * Validates organization access and injects organization ID into request context.
 */

import { NextRequest, NextResponse } from "next/server";
import { getOrganizationIdForUser, getUserRoleInOrganization, userHasOrganizationAccess, validateOrganizationExists } from "@/lib/organization-utils";
import { requireUser, requireUserForOrganization } from "@/lib/api-auth-guard";
import { cookies } from "next/headers";
import { createLogger } from "@nzila/os-core";

const logger = createLogger("organization-middleware");

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
      logger.error("withOrganizationAuth failed", { error: message, stack: error instanceof Error ? error.stack : undefined });
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
 * Get organization ID from cookies (for server components).
 * Reads selected_org_id / selected_organization_id cookie.
 * Returns null if none set.
 */
export async function getOrganizationId(): Promise<string | null> {
  const cookieStore = await cookies();
  return (
    cookieStore.get("selected_org_id")?.value ??
    cookieStore.get("selected_organization_id")?.value ??
    null
  );
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
    const userOrganizationId = await getOrganizationIdForUser(userId);
    
    // Check if organization exists
    const exists = await validateOrganizationExists(requestedOrganizationId);
    
    if (!exists) {
      return false;
    }

    if (userOrganizationId === requestedOrganizationId) {
      return true;
    }

    if (await userHasOrganizationAccess(userId, requestedOrganizationId)) {
      return true;
    }

    const roleInDefaultOrg = await getUserRoleInOrganization(userId, userOrganizationId);
    return roleInDefaultOrg === 'admin' || roleInDefaultOrg === 'system_admin' || roleInDefaultOrg === 'app_owner';
  } catch (_error) {
return false;
  }
}

/**
 * Extract organization ID from request headers or cookies
 *
 * Primary (new):
 * 1. X-Org-ID header
 * 2. selected_org_id cookie
 *
 * Existing:
 * 3. X-Organization-ID header
 * 4. selected_organization_id cookie
 *
 * Legacy fallback (deprecated):
 * 5. X-Tenant-ID header
 * 6. selected_tenant_id cookie
 *
 * 7. User's default organization
 */
export async function getOrganizationIdFromRequest(
  request: NextRequest,
  userId: string
): Promise<string> {
  // --- primary: X-Org-ID ---
  const shortHeader = request.headers.get("X-Org-ID");
  if (shortHeader) {
    const isValid = await validateOrganizationExists(shortHeader);
    if (isValid) return shortHeader;
  }

  // --- existing: X-Organization-ID ---
  const headerOrgId = request.headers.get("X-Organization-ID");
  if (headerOrgId) {
    const isValid = await validateOrganizationExists(headerOrgId);
    if (isValid) return headerOrgId;
  }

  const cookieStore = await cookies();

  // --- primary cookie: selected_org_id ---
  const orgCookie = cookieStore.get("selected_org_id")?.value;
  if (orgCookie) {
    const isValid = await validateOrganizationExists(orgCookie);
    if (isValid) return orgCookie;
  }

  // --- existing cookie: selected_organization_id ---
  const cookieOrgId = cookieStore.get("selected_organization_id")?.value;
  if (cookieOrgId) {
    const isValid = await validateOrganizationExists(cookieOrgId);
    if (isValid) return cookieOrgId;
  }

  // --- legacy fallback: X-Tenant-ID header (deprecated) ---
  const legacyHeader = request.headers.get("X-Tenant-ID");
  if (legacyHeader) {
    const isValid = await validateOrganizationExists(legacyHeader);
    if (isValid) return legacyHeader;
  }

  // --- legacy fallback: selected_tenant_id cookie (deprecated) ---
  const legacyCookie = cookieStore.get("selected_tenant_id")?.value;
  if (legacyCookie) {
    const isValid = await validateOrganizationExists(legacyCookie);
    if (isValid) return legacyCookie;
  }

  // Fall back to user's default organization
  return getOrganizationIdForUser(userId);
}

