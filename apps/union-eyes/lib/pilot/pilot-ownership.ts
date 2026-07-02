/**
 * Pilot application ownership enforcement (UE Hardening Wave — Phase 2).
 *
 * Invariant:
 *   A user cannot act on a pilot application by ID — mutate, transition,
 *   export, generate a proposal, or generate an artifact package — unless the
 *   application belongs to their organization OR the actor holds an explicit
 *   platform-level role.
 *
 * Ownership signal:
 *   The `pilot_applications` table has no `organization_id` column. The
 *   canonical owning organization is carried in `responses.organizationId`
 *   (the same field the commercial-transition route already uses to resolve
 *   the billing account). This module reads ONLY that field.
 *
 * Platform-level actors:
 *   App-operations / system roles (level >= `system_admin`, i.e. 200) and
 *   users in `PLATFORM_ADMIN_USER_IDS` (resolved by `getCurrentUser()` to
 *   `app_owner`) may act across organizations by design. Organization-level
 *   roles (steward, officer, admin, president, …) remain org-scoped and must
 *   match the pilot's owning organization.
 *
 * This module intentionally does NOT change the existing role gate
 * (`hasMinRole('steward')`) on each route — it adds the org-ownership gate
 * that was previously missing. Fail closed: any missing org context is denied.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { pilotApplications } from '@/db/schema';
import { getCurrentUser, normalizeRole, ROLE_HIERARCHY } from '@/lib/api-auth-guard';
import { logger } from '@/lib/logger';

/**
 * Minimum role level that may act on a pilot application across organizations.
 * Aligned with `ROLE_HIERARCHY.system_admin` (200). Org-level executives
 * (admin = 140, president = 130, …) are intentionally BELOW this line so they
 * remain scoped to their own organization.
 */
export const PILOT_PLATFORM_ACCESS_MIN_LEVEL: number = ROLE_HIERARCHY.system_admin;

export type PilotAccessDecision =
  | { ok: true; reason: 'platform' | 'same-org'; actorOrganizationId: string | null }
  | { ok: false; status: 401 | 403; reason: 'unauthenticated' | 'actor-missing-org-context' | 'pilot-missing-org-context' | 'cross-org' };

/**
 * Extract the owning organization id from a loaded pilot application.
 * Returns null when no usable owner organization is present (fail closed).
 */
export function getPilotOwnerOrganizationId(
  application: { responses?: Record<string, unknown> | null } | null | undefined,
): string | null {
  const responses = (application?.responses ?? {}) as Record<string, unknown>;
  const raw = responses.organizationId;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

/**
 * Core ownership decision. Resolves the current actor (identity, org, role)
 * via `getCurrentUser()` and decides whether they may act on a pilot owned by
 * `pilotOrganizationId`.
 *
 * Pure with respect to the supplied pilot org — all actor state comes from
 * `getCurrentUser()`, which makes this directly unit-testable.
 */
export async function authorizePilotAccess(
  pilotOrganizationId: string | null | undefined,
): Promise<PilotAccessDecision> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, status: 401, reason: 'unauthenticated' };
  }

  // Platform-level actors may act across organizations by design.
  const actorLevel = ROLE_HIERARCHY[normalizeRole(user.role ?? 'member')] ?? 0;
  if (actorLevel >= PILOT_PLATFORM_ACCESS_MIN_LEVEL) {
    return {
      ok: true,
      reason: 'platform',
      actorOrganizationId: typeof user.organizationId === 'string' ? user.organizationId : null,
    };
  }

  // Non-platform actors must have an org context AND own the pilot's org.
  const actorOrg = typeof user.organizationId === 'string' ? user.organizationId.trim() : '';
  const ownerOrg = typeof pilotOrganizationId === 'string' ? pilotOrganizationId.trim() : '';

  if (!actorOrg) {
    return { ok: false, status: 403, reason: 'actor-missing-org-context' };
  }
  if (!ownerOrg) {
    return { ok: false, status: 403, reason: 'pilot-missing-org-context' };
  }
  if (actorOrg !== ownerOrg) {
    return { ok: false, status: 403, reason: 'cross-org' };
  }

  return { ok: true, reason: 'same-org', actorOrganizationId: actorOrg };
}

/**
 * Route guard for an already-loaded pilot application.
 *
 * Returns a `NextResponse` (401/403) when access is denied, or `null` when the
 * caller may proceed. Call this AFTER the route has loaded the application and
 * returned 404 for a missing one, and BEFORE any mutation / export / system
 * context escalation / proposal or artifact generation.
 *
 * Usage:
 * ```ts
 * const denied = await enforcePilotOwnership(application);
 * if (denied) return denied;
 * ```
 */
export async function enforcePilotOwnership(
  application: { responses?: Record<string, unknown> | null },
): Promise<NextResponse | null> {
  const decision = await authorizePilotAccess(getPilotOwnerOrganizationId(application));
  if (decision.ok) {
    return null;
  }
  if (decision.status === 401) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

type FactoryRouteHandler = (
  request: NextRequest,
  nextContext?: { params?: Record<string, string> | Promise<Record<string, string>> },
) => Promise<Response> | Response;

/**
 * Wraps a CRUD-factory item handler (GET/PATCH/DELETE on
 * `/api/pilot/apply/[id]`) with an ownership pre-check.
 *
 * The base item route is generated by the shared `crudRoutes()` factory with
 * `orgScoped: false` (the table has no `organization_id` column), so it cannot
 * enforce ownership itself. This wrapper loads the pilot by its `id` param,
 * returns 404 if missing, enforces ownership, then delegates to the original
 * handler. It does not read the request body, so the factory's own body
 * parsing for PATCH is unaffected.
 */
export function withPilotOwnership(handler: FactoryRouteHandler, paramName = 'id'): FactoryRouteHandler {
  return async (request, nextContext) => {
    const params = nextContext?.params ? await nextContext.params : undefined;
    const id = params?.[paramName];

    // No id → let the factory handler produce its own canonical response.
    if (!id) {
      return handler(request, nextContext);
    }

    let application: { responses: Record<string, unknown> | null } | undefined;
    try {
      [application] = await db
        .select({ responses: pilotApplications.responses })
        .from(pilotApplications)
        .where(eq(pilotApplications.id, id));
    } catch (error) {
      logger.error(
        'pilot ownership pre-check failed to load application',
        error instanceof Error ? error : new Error(String(error)),
        { pilotId: id },
      );
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    if (!application) {
      return NextResponse.json({ error: 'Pilot application not found' }, { status: 404 });
    }

    const denied = await enforcePilotOwnership(application);
    if (denied) {
      return denied;
    }

    return handler(request, nextContext);
  };
}
