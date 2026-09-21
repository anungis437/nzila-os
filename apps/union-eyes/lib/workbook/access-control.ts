/**
 * Shared claimed-workbook ownership authority.
 *
 * Once a workbook is claimed (see app/api/workbook/[id]/claim/route.ts),
 * its identity-linked child data (memory holders, governance lineage,
 * etc.) must only be accessible to the claiming user or a member of the
 * same organization — the workbookId alone is no longer sufficient bearer
 * authority once real identity is attached.
 *
 * This module is the single source of truth for the claimed-workbook
 * authority chain. It closes the historic layering defect where a route
 * read the protected workbook on the tenant/plain connection BEFORE it had
 * established the authorization needed to perform that read, and then ran
 * every subsequent protected child query outside any DB execution context.
 *
 * Canonical authority (USER_PLUS_SAME_ORG):
 *   - unclaimed workbook  → bearer id is sufficient (pseudonymous authoring)
 *   - claimant            → the user who claimed it
 *   - same-organization   → a member of the org the workbook was claimed into
 *
 * Execution model — authorization is ALWAYS resolved before the first
 * protected query, and every protected query then runs inside the DB
 * execution context that matches the resolved authority:
 *   - claimant  → tenant runtime, user context = claimant (RLS scopes to self;
 *                 app.current_user_id = the real acting principal)
 *   - same_org  → bounded system context (mediated: the actor has been proven a
 *                 same-org peer; the callback constrains every query to this
 *                 single workbook_id). The owner is NEVER impersonated — the
 *                 DB session principal is union_eyes_system, not the claimant,
 *                 so no write is ever silently attributed to the owner. The
 *                 true actor is carried on `authority.actorUserId` for any
 *                 audit/attribution layer.
 *   - preclaim  → bounded system context (no identity is attached yet); the
 *                 callback constrains every query to this workbook_id
 */
import { auth } from '@nzila/platform-auth/entra/server';
import { eq } from 'drizzle-orm';
import { workbooks } from '@/db/schema/workbook-schema';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { withExplicitUserContext, withSystemContext } from '@/lib/db/with-rls-context';

export type WorkbookAccessResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 404; error: string };

export type WorkbookAuthorityKind = 'preclaim' | 'claimant' | 'same_org';

export interface ClaimedWorkbookAuthority {
  /** How the caller is authorized to reach this workbook's protected data. */
  kind: WorkbookAuthorityKind;
  workbookId: string;
  /** null only for pre-claim (unclaimed) workbooks. */
  claimedByUserId: string | null;
  /** Organization the workbook was claimed into (canonical same-org anchor). */
  claimedOrgId: string | null;
  /** Authenticated actor; null only for the pre-claim bearer path. */
  actorUserId: string | null;
  /** Operation intent the execution boundary was entered for. */
  operation?: 'read' | 'write';
}

type AuthorityDecision =
  | { ok: true; authority: ClaimedWorkbookAuthority }
  | { ok: false; status: 401 | 403 | 404; error: string };

/**
 * Resolve the claimed-workbook authority for the current request.
 *
 * The ownership lookup runs under a bounded system context so the
 * authorization decision does NOT depend on a caller context that has not
 * yet been established. Only ownership columns of the single workbook cross
 * this boundary — no child data is exposed by the lookup itself.
 */
async function resolveClaimedWorkbookAuthority(workbookId: string): Promise<AuthorityDecision> {
  const ownership = await withSystemContext(async (tx) => {
    const [wb] = await tx
      .select({
        id: workbooks.id,
        claimedByUserId: workbooks.claimedByUserId,
        claimedOrgId: workbooks.claimedOrgId,
      })
      .from(workbooks)
      .where(eq(workbooks.id, workbookId))
      .limit(1);
    return wb ?? null;
  });

  if (!ownership) {
    return { ok: false, status: 404, error: 'Workbook not found' };
  }

  if (!ownership.claimedByUserId) {
    // Unclaimed: the workbookId itself is the bearer credential.
    return {
      ok: true,
      authority: {
        kind: 'preclaim',
        workbookId,
        claimedByUserId: null,
        claimedOrgId: ownership.claimedOrgId ?? null,
        actorUserId: null,
      },
    };
  }

  const { userId } = await auth();
  if (!userId) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  if (ownership.claimedByUserId === userId) {
    return {
      ok: true,
      authority: {
        kind: 'claimant',
        workbookId,
        claimedByUserId: ownership.claimedByUserId,
        claimedOrgId: ownership.claimedOrgId ?? null,
        actorUserId: userId,
      },
    };
  }

  // Same-organization peer. Canonical owner org is the org stamped at claim
  // time (workbooks.claimed_org_id). Fall back to the claimant's currently
  // resolved org only for legacy rows claimed before that column was stamped.
  const requesterOrgId = await getOrganizationIdForUser(userId).catch(() => null);
  const ownerOrgId =
    ownership.claimedOrgId ??
    (await getOrganizationIdForUser(ownership.claimedByUserId).catch(() => null));

  if (!requesterOrgId || !ownerOrgId || requesterOrgId !== ownerOrgId) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return {
    ok: true,
    authority: {
      kind: 'same_org',
      workbookId,
      claimedByUserId: ownership.claimedByUserId,
      claimedOrgId: ownerOrgId,
      actorUserId: userId,
    },
  };
}

/**
 * Boolean authority check (backward-compatible surface). Delegates to the
 * single authority resolver — no protected child data is read here.
 */
export async function verifyClaimedWorkbookAccess(workbookId: string): Promise<WorkbookAccessResult> {
  const decision = await resolveClaimedWorkbookAuthority(workbookId);
  if (!decision.ok) {
    return { ok: false, status: decision.status, error: decision.error };
  }
  return { ok: true };
}

export type WithClaimedWorkbookAccessResult<T> =
  | { ok: true; value: T; authority: ClaimedWorkbookAuthority }
  | { ok: false; status: 401 | 403 | 404; error: string };

/**
 * Execution boundary for the claimed-workbook authority chain.
 *
 * Resolves authorization first, then runs `callback` inside the DB execution
 * context that matches the resolved authority. Every protected query the
 * callback performs (directly or via helpers that use the module-level `db`)
 * runs inside that established context — there is no window where a protected
 * query executes before authorization or outside the correct principal.
 *
 * The callback MUST constrain every query to `authority.workbookId`; the
 * boundary establishes the principal, not per-row scoping (for the preclaim
 * and same_org paths in particular).
 */
export async function withClaimedWorkbookAccess<T>(
  args: { workbookId: string; operation: 'read' | 'write' },
  callback: (authority: ClaimedWorkbookAuthority) => Promise<T>,
): Promise<WithClaimedWorkbookAccessResult<T>> {
  const decision = await resolveClaimedWorkbookAuthority(args.workbookId);
  if (!decision.ok) {
    return decision;
  }

  const authority: ClaimedWorkbookAuthority = {
    ...decision.authority,
    operation: args.operation,
  };

  let value: T;
  if (authority.kind === 'claimant') {
    // Claimant path: establish the claimant's own user context so tenant RLS
    // (workbooks.claimed_by_user_id = app.current_user_id) scopes every
    // protected child query to exactly this user's claimed data. Here the DB
    // session principal IS the real acting principal (the claimant).
    value = await withExplicitUserContext(
      authority.actorUserId as string,
      () => callback(authority),
      authority.claimedOrgId ?? undefined,
    );
  } else {
    // Same-organization peer OR pre-claim bearer: mediated model under a
    // bounded system context. For same_org, authorization has already proven
    // the actor belongs to the workbook's authorized organization; the owner
    // is NOT impersonated (the session principal is union_eyes_system, never
    // the claimant), which avoids silently attributing a peer's write to the
    // owner. For preclaim, no identity is attached yet. In both cases the
    // callback constrains every query to this single workbook_id — RLS is not
    // broadened org-wide — and the true actor (if any) is available on
    // authority.actorUserId for audit.
    value = await withSystemContext(() => callback(authority));
  }

  return { ok: true, value, authority };
}
