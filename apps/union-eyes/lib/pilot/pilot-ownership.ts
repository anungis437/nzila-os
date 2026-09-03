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
import { withSystemContext } from '@/lib/db/with-rls-context';
import { getCurrentUser, hasMinRole, normalizeRole, ROLE_HIERARCHY, type UserRole } from '@/lib/api-auth-guard';
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
 * Extract the CLAIMED owning organization id from a loaded pilot
 * application (PR #752 round 19: renamed from `getPilotOwnerOrganizationId`
 * to make the provenance explicit).
 *
 * This value comes straight from `responses.organizationId` — a field
 * submitted wholesale, unauthenticated, by the public `/api/pilot/apply`
 * intake form (see that route's own POST handler). It is a CLIENT
 * ASSERTION, never server-attested identity. It is safe to use ONLY for the
 * same-org self-service access-control gate below (low stakes: a submitter
 * who claims org X can only ever see/edit the row they themselves claimed —
 * no cross-tenant read is possible since a REAL member of org X must ALSO
 * independently match that same claim to pass `authorizePilotAccess`).
 * It must NEVER be trusted as verified ownership for financial operations —
 * see app/api/pilot/apply/[id]/commercial-transition/route.ts, which
 * requires platform-tier authorization (not same-org self-service) before
 * using this value to resolve or create real billing/contract records,
 * precisely because this field cannot be trusted for that purpose.
 * Returns null when no usable claim is present (fail closed).
 */
export function getPilotClaimedOrganizationId(
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
  const decision = await authorizePilotAccess(getPilotClaimedOrganizationId(application));
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
/**
 * Loads a pilot application row by id for the purpose of an ownership
 * decision (PR #752 round 18).
 *
 * The ownership decision itself requires seeing the row regardless of the
 * caller's own organization — a same-org actor and a cross-org attacker look
 * identical until the row's owning organization is known. That lookup must
 * therefore run under `withSystemContext()`, never the ordinary tenant
 * runtime connection: once a real RLS policy exists for this table (JSONB-
 * owner policy for tenant reads, per the eventual policy-expansion design),
 * a tenant-runtime connection would only be able to see rows that ALREADY
 * match the caller's own org — making the ownership check itself unable to
 * detect (and therefore reject) a cross-org id.
 */
export async function loadPilotApplicationForOwnershipCheck(
  id: string,
): Promise<{ responses: Record<string, unknown> | null } | undefined> {
  return withSystemContext((_tx) =>
    db
      .select({ responses: pilotApplications.responses })
      .from(pilotApplications)
      .where(eq(pilotApplications.id, id))
      .then(([application]) => application),
  );
}

export function withPilotOwnership(
  handler: FactoryRouteHandler,
  options: { paramName?: string; minRole?: UserRole } = {},
): FactoryRouteHandler {
  const { paramName = 'id', minRole = 'steward' } = options;
  return async (request, nextContext) => {
    // Authenticate + enforce the base role tier BEFORE touching the database
    // at all (PR #752 round 19). Previously the ownership pre-check lookup
    // ran (on the system connection) before any auth check, so an
    // unauthenticated request with a real pilot id got further (404 -> then
    // an auth failure downstream) than one with a made-up id (immediate
    // 404) — a cross-tenant record-existence oracle, plus a system-principal
    // SELECT triggered by a request that was never going to be allowed to
    // proceed. `hasMinRole` returns false for both "unauthenticated" and
    // "authenticated but under-role" (matching every sibling pilot action
    // route's own `hasMinRole('steward')` gate), so the response here is
    // uniform regardless of whether `id` exists.
    if (!(await hasMinRole(minRole))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const params = nextContext?.params ? await nextContext.params : undefined;
    const id = params?.[paramName];

    // No id → let the factory handler produce its own canonical response.
    if (!id) {
      return handler(request, nextContext);
    }

    let application: { responses: Record<string, unknown> | null } | undefined;
    try {
      application = await loadPilotApplicationForOwnershipCheck(id);
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

    const decision = await authorizePilotAccess(getPilotClaimedOrganizationId(application));
    if (!decision.ok) {
      return NextResponse.json(
        { error: decision.status === 401 ? 'Unauthorized' : 'Forbidden' },
        { status: decision.status },
      );
    }

    // Platform-tier actors act cross-org by design — the actual CRUD
    // operation must run on the system connection (union_eyes_system), not
    // the ordinary tenant runtime pool, so it is never gated by a future
    // tenant-scoped RLS policy on this table. Same-org actors keep running
    // on the ordinary runtime connection (app-layer-enforced today; the
    // eventual JSONB-owner tenant RLS policy scopes this path).
    if (decision.reason === 'platform') {
      return withSystemContext(async (_tx) => handler(request, nextContext));
    }
    return handler(request, nextContext);
  };
}
