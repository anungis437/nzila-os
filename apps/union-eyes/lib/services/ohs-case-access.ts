import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { cneesstFilings, memberEmployment, stewardAssignments, stewards } from '@/db/schema';
import { hasRoleInOrganization } from '@/lib/api-auth-guard';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';

/**
 * Case authority for CNESST/OHS records (DEF-0B4-OHS-FILINGS-NO-CASE-AUTHORITY,
 * DEF-0B5-OHS-WITHDRAWAL-REFUSAL-NO-CASE-AUTHORITY).
 *
 * A steward role floor is eligibility, not authority over every member's filing, withdrawal or refusal: until now
 * any steward of the organization read and rewrote every record. Authority now requires one of:
 *   - an officer (or higher) role, which already carries organization-wide OHS oversight in the sibling committee,
 *     pay-equity and assessment routes in this family;
 *   - the record's own designated representative (cnesst_filings.union_rep_id), or — for a right-of-refusal or
 *     preventive withdrawal linked to a filing by cnesst_filing_id — that filing's designated representative, for
 *     a case assigned outside the steward's ordinary coverage;
 *   - an active steward_assignments row whose bargaining unit, worksite or department covers the member's current
 *     employment record.
  * Nobody else reads, lists or changes the record. A member with no current employment row, or a steward with no
 * covering assignment and no designation, is refused — the same answer as a record that does not exist.
 *
 * cnesst_filings.member_id is nullable (a filing can report a workplace-level hazard with no member named); a
 * right-of-refusal or preventive withdrawal's member_id is not. A record that names no member claims no member's
 * case to protect, so it stays at the steward role floor the route already enforces, the same as the committee,
 * pay-equity and assessment routes in this family that have no case-authority layer at all.
 *
 * Each check opens its own tenant transaction (as lib/services/case-access-service.ts's getEffectiveCaseAccess
 * does), so it is safe to call from rowReadAuthority, lockedAuthCheck or beforeCreate alike, whichever already-
 * scoped handler it runs inside of.
 */

export type OhsCaseAccessReason = 'officer_or_above' | 'designated_representative' | 'coverage_match' | 'no_member_named' | 'no_authority';

export interface OhsCaseAccessDecision {
  allowed: boolean;
  reason: OhsCaseAccessReason;
}

const COVERING_EMPLOYMENT_STATUSES = ['active', 'on_leave'] as const;

export async function evaluateOhsCaseAccess(input: {
  organizationId: string;
  actorUserId: string;
  memberId: string | null | undefined;
  /** The record's own representative column (cnesst_filings.union_rep_id), when the table has one. */
  designatedRepId?: string | null;
  /** A right-of-refusal or preventive-withdrawal row's optional link to the filing it arose from. */
  linkedCneesstFilingId?: string | null;
}): Promise<OhsCaseAccessDecision> {
  if (await hasRoleInOrganization(input.organizationId, 'officer', input.actorUserId)) {
    return { allowed: true, reason: 'officer_or_above' };
  }
  if (input.designatedRepId && input.designatedRepId === input.actorUserId) {
    return { allowed: true, reason: 'designated_representative' };
  }
  if (input.linkedCneesstFilingId) {
    const transitiveRepId = await filingDesignatedRep({
      organizationId: input.organizationId,
      cneesstFilingId: input.linkedCneesstFilingId,
    });
    if (transitiveRepId && transitiveRepId === input.actorUserId) {
      return { allowed: true, reason: 'designated_representative' };
    }
  }
  if (!input.memberId) return { allowed: true, reason: 'no_member_named' };
  const covers = await stewardCoversMember({
    organizationId: input.organizationId,
    stewardUserId: input.actorUserId,
    memberId: input.memberId,
  });
  return covers ? { allowed: true, reason: 'coverage_match' } : { allowed: false, reason: 'no_authority' };
}

/** The filing's own designated representative, for a right-of-refusal or withdrawal row linked to it. */
async function filingDesignatedRep(input: { organizationId: string; cneesstFilingId: string }): Promise<string | null> {
  return withRLSContext({ organizationId: input.organizationId }, async (tx) => {
    const [filing] = await tx
      .select({ unionRepId: cneesstFilings.unionRepId })
      .from(cneesstFilings)
      .where(and(eq(cneesstFilings.id, input.cneesstFilingId), eq(cneesstFilings.organizationId, input.organizationId)))
      .limit(1);
    return filing?.unionRepId ?? null;
  });
}

/** Whether any of the steward's active assignments covers the bargaining unit, worksite or department of the member's current employment. */
export async function stewardCoversMember(input: {
  organizationId: string;
  stewardUserId: string;
  memberId: string;
}): Promise<boolean> {
  return withRLSContext({ organizationId: input.organizationId }, async (tx) => {
    const [employment] = await tx
      .select({
        worksiteId: memberEmployment.worksiteId,
        bargainingUnitId: memberEmployment.bargainingUnitId,
        department: memberEmployment.department,
      })
      .from(memberEmployment)
      .where(and(
        eq(memberEmployment.organizationId, input.organizationId),
        eq(memberEmployment.memberId, input.memberId),
        inArray(memberEmployment.employmentStatus, [...COVERING_EMPLOYMENT_STATUSES]),
      ))
      .limit(1);
    if (!employment) return false;

    const stewardProfiles = await tx
      .select({ id: stewards.id })
      .from(stewards)
      .where(and(eq(stewards.userId, input.stewardUserId), eq(stewards.orgId, input.organizationId), eq(stewards.active, true)));
    if (stewardProfiles.length === 0) return false;

    const coverageMatch = [
      employment.bargainingUnitId ? eq(stewardAssignments.unitId, employment.bargainingUnitId) : undefined,
      employment.worksiteId ? eq(stewardAssignments.worksiteId, employment.worksiteId) : undefined,
      employment.department ? sql`lower(${stewardAssignments.department}) = lower(${employment.department})` : undefined,
    ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
    if (coverageMatch.length === 0) return false;

    const [match] = await tx
      .select({ id: stewardAssignments.id })
      .from(stewardAssignments)
      .where(and(
        eq(stewardAssignments.organizationId, input.organizationId),
        inArray(stewardAssignments.stewardId, stewardProfiles.map((profile) => profile.id)),
        eq(stewardAssignments.status, 'active'),
        or(...coverageMatch),
      ))
      .limit(1);
    return Boolean(match);
  });
}

// ── Per-table wiring for crud-factory's rowReadAuthority / lockedAuthCheck / beforeCreate hooks ──────────────────

/** The generic route's per-row read hook for CNESST filings: the row's own member and designated representative decide. */
export async function filingRowReadable(row: Record<string, unknown>, caller: { userId: string; organizationId: string | null | undefined }): Promise<boolean> {
  if (!caller.organizationId) return false;
  const decision = await evaluateOhsCaseAccess({
    organizationId: caller.organizationId,
    actorUserId: caller.userId,
    memberId: typeof row.memberId === 'string' ? row.memberId : null,
    designatedRepId: typeof row.unionRepId === 'string' ? row.unionRepId : null,
  });
  return decision.allowed;
}

/** The generic route's locked update/delete hook for CNESST filings, decided against the row loaded under the update's own lock. */
export async function filingLockedAuthCheck(
  existing: Record<string, unknown>,
  ctx: { id: string; organizationId?: string | null; userId?: string | null },
): Promise<{ ok: true } | { ok: false; status: 401 | 403 }> {
  if (!ctx.organizationId || !ctx.userId) return { ok: false, status: 403 };
  const decision = await evaluateOhsCaseAccess({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    memberId: typeof existing.memberId === 'string' ? existing.memberId : null,
    designatedRepId: typeof existing.unionRepId === 'string' ? existing.unionRepId : null,
  });
  return decision.allowed ? { ok: true } : { ok: false, status: 403 };
}

/** The generic route's per-row read hook for right-of-refusal events and preventive withdrawals (no representative column of their own). */
export async function linkedOhsRecordRowReadable(row: Record<string, unknown>, caller: { userId: string; organizationId: string | null | undefined }): Promise<boolean> {
  if (!caller.organizationId) return false;
  const decision = await evaluateOhsCaseAccess({
    organizationId: caller.organizationId,
    actorUserId: caller.userId,
    memberId: typeof row.memberId === 'string' ? row.memberId : null,
    linkedCneesstFilingId: typeof row.cneesstFilingId === 'string' ? row.cneesstFilingId : null,
  });
  return decision.allowed;
}

/** The generic route's locked update/delete hook for right-of-refusal events and preventive withdrawals. */
export async function linkedOhsRecordLockedAuthCheck(
  existing: Record<string, unknown>,
  ctx: { id: string; organizationId?: string | null; userId?: string | null },
): Promise<{ ok: true } | { ok: false; status: 401 | 403 }> {
  if (!ctx.organizationId || !ctx.userId) return { ok: false, status: 403 };
  const decision = await evaluateOhsCaseAccess({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    memberId: typeof existing.memberId === 'string' ? existing.memberId : null,
    linkedCneesstFilingId: typeof existing.cneesstFilingId === 'string' ? existing.cneesstFilingId : null,
  });
  return decision.allowed ? { ok: true } : { ok: false, status: 403 };
}

/**
 * The generic route's create-time gate: a steward may open a filing, right-of-refusal or withdrawal for the member
 * named in the body only when they hold case authority over that member (officer, coverage or an already-linked
 * filing's designated representative). Throws rather than returning a boolean, so a route's beforeCreate can call
 * it directly and let the thrown ApiError fail the request before any row is inserted.
 */
export async function assertOhsCaseAccessForCreate(input: {
  organizationId: string | null | undefined;
  actorUserId: string | null | undefined;
  memberId: unknown;
  linkedCneesstFilingId?: unknown;
}): Promise<void> {
  if (!input.organizationId || !input.actorUserId) throw ApiError.forbidden();
  const decision = await evaluateOhsCaseAccess({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    memberId: typeof input.memberId === 'string' ? input.memberId : null,
    linkedCneesstFilingId: typeof input.linkedCneesstFilingId === 'string' ? input.linkedCneesstFilingId : null,
  });
  if (!decision.allowed) throw ApiError.forbidden('You do not hold case authority over this member.');
}
