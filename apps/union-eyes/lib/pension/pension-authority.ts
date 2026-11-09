/**
 * Pension authority (UE-CONV-K-011).
 *
 * Pension records are personal and financial: a member's benefit claims, contributions and tax slips are theirs, and
 * administering a plan, enrolling members, recording contributions or issuing tax records is a fiduciary duty, not a
 * steward's. Until the trustee-administration authority is implemented (see the trustee routes), the only
 * administration authority is the financial role already used for member financial data; every other caller is limited
 * to their own pension records.
 */
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { organizationMembers, pensionMembers, pensionTrusteeMandates } from '@/db/schema';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { ApiError } from '@/lib/api/errors';

export const PENSION_ADMIN_ROLES = FINANCIAL_MEMBER_DATA_ROLES;

export const isPensionAdministrator = (role: string | null | undefined): boolean =>
  !!role && (PENSION_ADMIN_ROLES as readonly string[]).includes(role);

export async function requirePensionTrusteeMandate(
  tx: RLSTx,
  input: { organizationId: string; userId: string; planId?: string | null; action: string },
) {
  const now = new Date();
  const [mandate] = await tx
    .select()
    .from(pensionTrusteeMandates)
    .where(and(
      eq(pensionTrusteeMandates.organizationId, input.organizationId),
      eq(pensionTrusteeMandates.actorUserId, input.userId),
      eq(pensionTrusteeMandates.action, input.action),
      input.planId ? eq(pensionTrusteeMandates.planId, input.planId) : isNull(pensionTrusteeMandates.planId),
      lte(pensionTrusteeMandates.validFrom, now),
      gt(pensionTrusteeMandates.validUntil, now),
      isNull(pensionTrusteeMandates.revokedAt),
    ))
    .limit(1);
  if (!mandate) throw ApiError.forbidden('A live plan-scoped trustee mandate is required');
  return mandate;
}

/**
 * The identifiers under which the caller's own pension records are filed in this organization: their membership id
 * (pension_members.user_id holds the organization_members row id, not the auth user id) and the id of each of their
 * pension enrolments. Empty when the caller has no active membership, so a caller with no relationship sees nothing.
 */
export async function ownPensionIdentities(tx: RLSTx, organizationId: string, userId: string): Promise<string[]> {
  const [membership] = await tx
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId)))
    .limit(1);
  if (!membership) return [];

  const enrolments = await tx
    .select({ id: pensionMembers.id })
    .from(pensionMembers)
    .where(and(eq(pensionMembers.organizationId, organizationId), eq(pensionMembers.userId, membership.id)));
  return [membership.id, ...enrolments.map((e) => e.id)];
}
