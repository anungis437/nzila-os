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
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { commercialContracts, orgSubscriptions, pilotApplications, platformInvoices, organizations } from '@/db/schema';
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
 * `beforeUpdate` hook for the pilot item CRUD route (`app/api/pilot/apply/
 * [id]/route.ts`, PR #752 round 22).
 *
 * `responses.organizationId` is the claim `getPilotClaimedOrganizationId()`
 * reads for ordinary same-org access control. It is a nested JSONB
 * subfield, so `blockedPatchFields` (a flat list of top-level column names)
 * cannot protect it — without this hook, a same-org steward could pass the
 * ownership pre-check on Org A's row, then PATCH `responses.organizationId`
 * to Org B, silently transferring subsequent same-org access to Org B
 * entirely at the application layer (an ownership-transfer primitive with
 * no platform-tier involvement at all). This forces the claimed
 * organizationId back to the row's EXISTING value no matter what the client
 * sends; every other key inside `responses` remains ordinarily editable.
 * Exported for direct unit testing, independent of the crud-factory wiring.
 */
export function preserveClaimedOrganizationOnPatch(
  updates: Record<string, unknown>,
  existing: { responses?: Record<string, unknown> | null },
): Record<string, unknown> {
  if (!('responses' in updates)) {
    return updates;
  }

  const existingResponses = (existing.responses ?? {}) as Record<string, unknown>;
  const claimedOrganizationId = existingResponses.organizationId;
  const nextResponses =
    updates.responses && typeof updates.responses === 'object' && !Array.isArray(updates.responses)
      ? { ...(updates.responses as Record<string, unknown>) }
      : {};

  if (claimedOrganizationId === undefined) {
    delete nextResponses.organizationId;
  } else {
    nextResponses.organizationId = claimedOrganizationId;
  }

  return { ...updates, responses: nextResponses };
}

/**
 * Extract the VERIFIED owning organization id from a loaded pilot
 * application (PR #752 round 20).
 *
 * Unlike `getPilotClaimedOrganizationId()`, this reads the server-controlled
 * `verified_organization_id` COLUMN — null until an explicit platform-tier
 * "verify organization" action (`bindPilotOrganization()` below) has
 * independently confirmed the claim. This is the ONLY value that may be used
 * for financial operations (billing account resolution, contract/invoice/
 * subscription creation) or any future RLS policy — never the client-
 * supplied claim.
 */
export function getPilotVerifiedOrganizationId(
  application: { verifiedOrganizationId?: string | null } | null | undefined,
): string | null {
  const raw = application?.verifiedOrganizationId;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

export type BindPilotOrganizationResult =
  | { ok: true; organizationId: string }
  | { ok: false; status: 404 | 409; error: string };

/**
 * True if `pilotId` has ANY real financial artifact — a commercial
 * contract, platform invoice, or org subscription — created by the
 * commercial-transition FSM (PR #752 round 22).
 *
 * Round 21's rebind guard only checked `commercialContracts` (via the
 * deterministic `buildPilotContractNumber` key), but commercial-transition's
 * `invoice_issued` and `subscription_active` branches can each create a
 * real `platformInvoices`/`orgSubscriptions` row independently of the
 * `contract_sent` branch (e.g. via `allowSkip`) — so a pilot could carry a
 * real invoice or subscription with no contract at all, and the old check
 * would let a rebind proceed without requiring
 * `acknowledgeFinancialArtifacts`. All three tables are written with the
 * SAME `metadata: { source: 'pilot-commercial-transition', pilotApplicationId }`
 * shape by that route, so this checks all three by that shared marker
 * rather than a table-specific key.
 */
async function pilotHasFinancialArtifacts(pilotId: string): Promise<boolean> {
  const pilotApplicationIdMatch = (column: unknown) => sql`${column}->>'pilotApplicationId' = ${pilotId}`;

  const [contract] = await db
    .select({ id: commercialContracts.id })
    .from(commercialContracts)
    .where(pilotApplicationIdMatch(commercialContracts.metadata));
  if (contract) return true;

  const [invoice] = await db
    .select({ id: platformInvoices.id })
    .from(platformInvoices)
    .where(pilotApplicationIdMatch(platformInvoices.metadata));
  if (invoice) return true;

  const [subscription] = await db
    .select({ id: orgSubscriptions.id })
    .from(orgSubscriptions)
    .where(pilotApplicationIdMatch(orgSubscriptions.metadata));
  if (subscription) return true;

  return false;
}

/**
 * Platform-only binding of a pilot application to a verified organization
 * (PR #752 round 20; made immutable-by-default in round 21). This is the
 * ONLY function that may write `verified_organization_id`/`verified_by`/
 * `verified_at` — callers must already have confirmed platform-tier
 * authority (`hasMinRole('system_admin')`) before calling this; it does not
 * itself perform that check.
 *
 * Fails closed if the target organization does not exist (a claimed id that
 * was never a real organization must never become "verified"). Runs under
 * `withSystemContext()`: both the existence check and the write need to
 * operate cross-org, independent of any RLS policy on either table.
 *
 * Immutability (round 21): a pilot application's verified organization is a
 * financial-identity fact, not a freely-editable field. Once bound:
 *   - Re-binding to the SAME organization is a no-op success (idempotent —
 *     a platform admin re-running the same verify call, e.g. after a
 *     timeout, must not error or re-stamp verifiedAt for no reason).
 *   - Re-binding to a DIFFERENT organization is rejected with 409. Changing
 *     which organization a pilot's billing/contracts belong to is a
 *     deliberate correction, not an ordinary verification step — see
 *     `rebindPilotOrganization()` below.
 *
 * Concurrency (round 22): the pilot row is read with `FOR UPDATE` inside
 * `withSystemContext`'s real transaction, so two concurrent binds for the
 * SAME pilot (e.g. racing verify-organization calls for two different
 * target orgs) serialize instead of both observing
 * `verifiedOrganizationId = NULL` and racing to write — the second
 * transaction blocks until the first commits, then correctly sees the
 * now-set value and returns idempotent-success or 409 rather than
 * silently overwriting it. The same lock also serializes against
 * commercial-transition's monetization transaction, which takes the same
 * `FOR UPDATE` lock on this row before creating any financial artifact.
 */
export async function bindPilotOrganization(params: {
  pilotId: string;
  organizationId: string;
  verifiedBy: string;
}): Promise<BindPilotOrganizationResult> {
  const { pilotId, organizationId, verifiedBy } = params;

  return withSystemContext(async (_tx) => {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    if (!org) {
      return { ok: false, status: 404, error: 'Organization not found' };
    }

    const [pilot] = await db
      .select({ verifiedOrganizationId: pilotApplications.verifiedOrganizationId })
      .from(pilotApplications)
      .where(eq(pilotApplications.id, pilotId))
      .limit(1)
      .for('update');

    if (!pilot) {
      return { ok: false, status: 409, error: 'Pilot application not found' };
    }

    if (pilot.verifiedOrganizationId) {
      if (pilot.verifiedOrganizationId === organizationId) {
        return { ok: true, organizationId };
      }
      return {
        ok: false,
        status: 409,
        error:
          'This pilot application is already bound to a different verified organization. ' +
          'Use the platform rebind-organization correction flow to change it.',
      };
    }

    const [updated] = await db
      .update(pilotApplications)
      .set({
        verifiedOrganizationId: organizationId,
        verifiedBy,
        verifiedAt: new Date(),
      })
      .where(eq(pilotApplications.id, pilotId))
      .returning({ id: pilotApplications.id });

    if (!updated) {
      return { ok: false, status: 409, error: 'Pilot application not found' };
    }

    return { ok: true, organizationId };
  });
}

export type RebindPilotOrganizationResult =
  | { ok: true; organizationId: string; previousOrganizationId: string }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Platform-only CORRECTION of an already-bound pilot application's verified
 * organization (PR #752 round 21). Deliberately separate from
 * `bindPilotOrganization()` — that function is the ordinary, immutable
 * verification step and now refuses to change an existing binding; this
 * function exists specifically for the rare case where an initial
 * verification was wrong and must be corrected.
 *
 * Guardrails:
 *   - Requires a non-empty `reason` — enforced by the caller's zod schema;
 *     this function also fails closed if `reason` is blank, in case a
 *     future caller skips that validation.
 *   - Fails closed (404) if the target organization does not exist.
 *   - Fails closed (409) if the pilot is not yet bound at all — a rebind
 *     presupposes an existing binding; use `bindPilotOrganization()` first.
 *   - Fails closed (409) if this pilot has any real financial artifact
 *     (see `pilotHasFinancialArtifacts` — commercial contract, platform
 *     invoice, OR org subscription, not just a contract) UNLESS the caller
 *     explicitly passes `acknowledgeFinancialArtifacts: true`. Rebinding
 *     after real financial records exist would silently misattribute them
 *     to the new organization; this function does NOT migrate those rows —
 *     the acknowledgement is a deliberate opt-in that the caller has a
 *     separate plan for reconciling them, not an automatic migration.
 *   - The pilot row is locked with `FOR UPDATE` for the same concurrency
 *     reason described on `bindPilotOrganization()` — this also closes the
 *     TOCTOU window between this function's own artifact check and a
 *     concurrent commercial-transition creating one, since both now
 *     contend for the same row lock before proceeding.
 *   - Logs a structured warning (`logger.warn`) with the full
 *     before/after/reason/actor for traceability. This is NOT currently a
 *     durable, queryable audit-event row (no `audit_logs` write) — treat it
 *     as "logged for traceability," not "audited," until that gap is
 *     closed.
 */
export async function rebindPilotOrganization(params: {
  pilotId: string;
  organizationId: string;
  verifiedBy: string;
  reason: string;
  acknowledgeFinancialArtifacts?: boolean;
}): Promise<RebindPilotOrganizationResult> {
  const { pilotId, organizationId, verifiedBy, acknowledgeFinancialArtifacts = false } = params;
  const reason = params.reason?.trim() ?? '';

  if (!reason) {
    return { ok: false, status: 409, error: 'A non-empty reason is required to rebind a pilot application\'s verified organization.' };
  }

  return withSystemContext(async (_tx) => {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    if (!org) {
      return { ok: false, status: 404, error: 'Organization not found' };
    }

    const [pilot] = await db
      .select({ verifiedOrganizationId: pilotApplications.verifiedOrganizationId })
      .from(pilotApplications)
      .where(eq(pilotApplications.id, pilotId))
      .limit(1)
      .for('update');

    if (!pilot) {
      return { ok: false, status: 409, error: 'Pilot application not found' };
    }

    if (!pilot.verifiedOrganizationId) {
      return {
        ok: false,
        status: 409,
        error: 'This pilot application is not yet bound to any organization; use bindPilotOrganization (verify-organization) instead of rebind.',
      };
    }

    const previousOrganizationId = pilot.verifiedOrganizationId;

    if (previousOrganizationId === organizationId) {
      return { ok: true, organizationId, previousOrganizationId };
    }

    const hasFinancialArtifacts = await pilotHasFinancialArtifacts(pilotId);

    if (hasFinancialArtifacts && !acknowledgeFinancialArtifacts) {
      return {
        ok: false,
        status: 409,
        error:
          'This pilot already has financial artifacts (a commercial contract, platform invoice, or ' +
          'org subscription) under its current verified organization. Rebinding would misattribute ' +
          'existing commercial records. Pass acknowledgeFinancialArtifacts=true with an explicit ' +
          'reason to proceed — this does NOT migrate the existing contract, invoice, or subscription ' +
          'rows, which still reference the previous organization and must be corrected separately.',
      };
    }

    await db
      .update(pilotApplications)
      .set({
        verifiedOrganizationId: organizationId,
        verifiedBy,
        verifiedAt: new Date(),
      })
      .where(eq(pilotApplications.id, pilotId));

    logger.warn('pilot application verified-organization rebind (correction)', {
      pilotId,
      previousOrganizationId,
      organizationId,
      verifiedBy,
      reason,
      hadFinancialArtifacts: hasFinancialArtifacts,
      acknowledgeFinancialArtifacts,
    });

    return { ok: true, organizationId, previousOrganizationId };
  });
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
