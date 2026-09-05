import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/api-auth-guard';
import { getOrganizationIdForUser } from '@/lib/organization-utils';

type NextRouteContext = { params?: Promise<Record<string, string>> | Record<string, string> };
type RouteHandler = (req: NextRequest, ctx?: NextRouteContext) => Promise<Response>;

/**
 * PR #752 round 11: wraps a crudRoutes({ table: organizations, orgScoped:
 * false, itemRoute: true }) handler so the URL's `[id]` param must equal
 * the caller's OWN organizationId before delegating.
 *
 * crudRoutes' auto org-scoping (`eq(orgCol, organizationId)`) looks up an
 * `organizationId` COLUMN on the target table — but here the table IS
 * `organizations` itself (its own identity column is `id`, not
 * `organizationId`), so orgScoped:false was used and crudRoutes applied
 * NO filter beyond the URL's raw `[id]` at all. That left
 * /api/organizations/[id]/sharing-settings and
 * /api/organizations/[id]/access-logs as an unrestricted cross-tenant
 * IDOR: any authenticated member could GET any other organization's full
 * row by ID, any steward could PATCH one, and any org's own admin could
 * DELETE (archive) any OTHER organization entirely, by ID.
 */
export function requireOwnOrganizationItem(paramName: string, handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawParams = ctx?.params;
    const params = rawParams instanceof Promise ? await rawParams : (rawParams ?? {});
    const requestedId = params[paramName];

    const ownOrgId = await getOrganizationIdForUser(user.id);
    if (!ownOrgId || requestedId !== ownOrgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return handler(req, ctx);
  };
}
