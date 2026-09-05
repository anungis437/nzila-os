/**
 * Centralized, lock-then-reauthorize pilot application mutation primitive
 * (PR #752 round 25).
 *
 * Every existing pilot mutation path built its own read -> decide -> write
 * sequence, each with a different gap between the ownership DECISION and
 * the actual WRITE:
 *
 *   - The generic CRUD PATCH route ([id]/route.ts) ran `withPilotOwnership`'s
 *     ownership pre-check against an UNLOCKED read, then delegated to
 *     `crudRoutes()`'s own, SEPARATE `SELECT ... FOR UPDATE` — a same-org
 *     actor could pass the pre-check, have the platform rebind the pilot to
 *     a different organization, and still have their PATCH's own lock+write
 *     go through against the (now foreign) row. Round 25 closed this one
 *     with `CrudOptions.lockedAuthCheck` (see lib/api/crud-factory.ts).
 *   - intelligence/artifacts/reference-profile's POST handlers ran
 *     `enforcePilotOwnership()` against an UNLOCKED read and then, entirely
 *     separately (no transaction, no lock at all), issued a plain
 *     `.update(pilotApplications).set({responses: fullReplace})` — the
 *     same rebind TOCTOU, PLUS an independent "server writer vs server
 *     writer" lost-update race against commercial-transition (which DOES
 *     lock the row): whichever of these un-locked routes read `responses`
 *     last, before commercial-transition committed a change, would
 *     silently revert it on write.
 *
 * `withLockedPilotMutation()` closes both gaps for every caller that uses
 * it: the row is loaded with `SELECT ... FOR UPDATE` FIRST, the effective
 * owner is re-authorized against THAT locked, guaranteed-fresh row (never
 * any earlier snapshot), and only a caller-supplied JSONB *merge* fragment
 * (never a full-column replace) is written — under the SAME lock, in the
 * SAME transaction, so nothing else can be committed and then reverted in
 * the gap between the check and the write, and a merge fragment can never
 * mention (and therefore can never revert) any key it doesn't explicitly
 * list.
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { pilotApplications } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { hasMinRole, type UserRole } from '@/lib/api-auth-guard';
import { buildMergeSetValues } from '@/lib/api/crud-factory';
import { authorizePilotAccess, getPilotEffectiveOrganizationId } from './pilot-ownership';

export type PilotApplicationRow = typeof pilotApplications.$inferSelect;

/**
 * Signals a structured, expected rejection discovered inside the locked
 * transaction (missing row, unauthenticated actor, or a failed ownership
 * re-check) — thrown to roll the transaction back, then translated back
 * into the exact HTTP response by the outer catch. Mirrors the same
 * pattern already used by commercial-transition's own
 * `CommercialTransitionRejected`.
 */
class LockedPilotMutationRejected extends Error {
  constructor(
    public readonly status: number,
    public readonly body: Record<string, unknown>,
  ) {
    super('locked pilot mutation rejected');
  }
}

export type LockedPilotMutationOutcome<T> =
  | { ok: true; application: PilotApplicationRow; data: T }
  | { ok: false; response: NextResponse };

/**
 * Runs `mutate` against a `FOR UPDATE`-locked, freshly-reauthorized pilot
 * application row, then merges `mutate`'s returned `responsesPatch` (if
 * any) into the row's `responses` column via a JSONB merge (never a
 * full-column replace) — all inside one transaction.
 *
 * Callers should NOT re-implement their own pilot ownership check, lock,
 * or `responses` read/write for a mutation limited to specific
 * `responses` keys — this function is the sanctioned way to do so (PR
 * #752 round 25). It always runs the locked read + write on the
 * system-authorized connection, matching the precedent already
 * established by `bindPilotOrganization`/`rebindPilotOrganization`/
 * commercial-transition (all of which lock and mutate this same row
 * entirely under `withSystemContext()`), so platform-tier and same-org
 * actors alike get the same atomicity guarantee.
 *
 * `mutate` receives the LOCKED, freshly-read `application` row — it must
 * derive any "current value" it needs (e.g. an array field it is
 * appending to) from THIS row, never from an earlier, unlocked read a
 * caller may have taken before invoking this function, or the same
 * lost-update race this primitive exists to close would simply move into
 * the caller.
 */
export async function withLockedPilotMutation<T>(
  pilotId: string,
  minRole: UserRole,
  mutate: (ctx: {
    application: PilotApplicationRow;
  }) => Promise<{ responsesPatch?: Record<string, unknown>; data: T }>,
): Promise<LockedPilotMutationOutcome<T>> {
  if (!(await hasMinRole(minRole))) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  try {
    const outcome = await withSystemContext(async (tx) => {
      const [application] = await tx
        .select()
        .from(pilotApplications)
        .where(eq(pilotApplications.id, pilotId))
        .limit(1)
        .for('update');

      if (!application) {
        throw new LockedPilotMutationRejected(404, { error: 'Pilot application not found' });
      }

      // Re-authorize under the SAME lock the write below will use — the
      // ownership decision and the mutation can therefore never be
      // separated by a concurrent rebind (round 25's TOCTOU fix).
      const decision = await authorizePilotAccess(getPilotEffectiveOrganizationId(application));
      if (!decision.ok) {
        throw new LockedPilotMutationRejected(decision.status, {
          error: decision.status === 401 ? 'Unauthorized' : 'Forbidden',
        });
      }

      const { responsesPatch, data } = await mutate({ application: application as PilotApplicationRow });

      if (responsesPatch && Object.keys(responsesPatch).length > 0) {
        const setValues = buildMergeSetValues({ responses: responsesPatch }, pilotApplications, ['responses']);
        await tx.update(pilotApplications).set(setValues).where(eq(pilotApplications.id, pilotId));
      }

      return { application: application as PilotApplicationRow, data };
    });

    return { ok: true, application: outcome.application, data: outcome.data };
  } catch (err) {
    if (err instanceof LockedPilotMutationRejected) {
      return { ok: false, response: NextResponse.json(err.body, { status: err.status }) };
    }
    throw err;
  }
}
