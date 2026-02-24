/**
 * Tenant Middleware (Legacy)
 * 
 * Deprecated: organizationId is the primary scope. This wrapper maps tenantId
 * to organizationId for backward compatibility in older routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { withOrganizationAuth, validateOrganizationAccess, getOrganizationIdFromRequest, type OrganizationContext } from "@/lib/organization-middleware";

export interface TenantContext {
  organizationId: string;
  userId: string;
  memberId: string;
}

/**
 * Middleware to extract and validate tenant context
 * 
 * Usage in API routes:
 * ```typescript
 * import { withTenantAuth } from "@/lib/tenant-middleware";
 * 
 * export const GET = withTenantAuth(async (request, context) => {
 *   const { organizationId, userId } = context;
 *   // Your tenant-aware logic here
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withTenantAuth<T = any>(
  handler: (
    request: NextRequest,
    context: TenantContext,
    params?: T
  ) => Promise<NextResponse> | NextResponse
) {
  return withOrganizationAuth(async (request: NextRequest, context: OrganizationContext, params?: T) => {
    const tenantContext: TenantContext = {
      organizationId: context.organizationId,
      userId: context.userId,
      memberId: context.memberId,
    };

    return await handler(request, tenantContext, params);
  });
}

/**
 * Validate tenant access for a specific tenant ID
 * 
 * Use this when the tenant ID comes from the request (e.g., URL parameter)
 * to ensure the user has access to that specific tenant.
 */
export async function validateTenantAccess(
  userId: string,
  requestedOrganizationId: string
): Promise<boolean> {
return validateOrganizationAccess(userId, requestedOrganizationId);
}

/**
 * Extract tenant ID from request headers or cookies
 * 
 * Checks in order:
 * 1. X-Tenant-ID header
 * 2. selected_tenant_id cookie
 * 3. User's default tenant
 */
export async function getTenantIdFromRequest(
  request: NextRequest,
  userId: string
): Promise<string> {
return getOrganizationIdFromRequest(request, userId);
}

