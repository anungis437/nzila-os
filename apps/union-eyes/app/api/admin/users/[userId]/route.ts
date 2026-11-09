/**
 * PUT /api/admin/users/[userId] — Toggle user status (active/inactive)
 * DELETE /api/admin/users/[userId] — Soft-delete user (set deleted_at)
 *
 * Phase 2 Domain 5: Member status enforcement + synchronous access
 * revocation.
 *
 * PR #752 round 12: the [userId] route param is actually
 * organizationMembers.id (the membership row's own UUID primary key), NOT
 * the authenticated user's principal (organizationMembers.userId). Round
 * 11 and earlier conflated the two — passing the membership row id to
 * revokeAllUserSessions()/case-access revocation, both of which are keyed
 * by the real auth user id, meant those calls silently matched zero rows.
 * The param NAME is left unchanged (`[userId]`) to avoid an unrelated
 * route-shape/caller break; internally it is resolved and used strictly
 * as `membershipId`, with `authUserId` fetched and threaded separately.
 *
 * Also per round 12: offboarding is no longer certified from an emitted
 * event. `revokeMemberAccess()` (lib/services/member-access-revocation-
 * service.ts) is called synchronously and its `success` flag gates the
 * HTTP response — if any required revocation step fails, this route
 * returns 502, not 200. The lookup/mutation of organizationMembers below
 * runs under withSystemContext(): a platform-admin caller (gated by
 * canonical authority in V2, legacy PLATFORM_ADMIN_USER_IDS otherwise) has no ordinary tenant RLS context for
 * an arbitrary target organization, so execution must be under the
 * system role, not the tenant runtime role. The platform-authority
 * check itself stays OUTSIDE/BEFORE withSystemContext — the authorization
 * decision is made on the caller's real identity before any system-
 * privileged execution begins.
 *
 * #1116 (direct, specific authority): the platform title is not enough on
 * its own. Once the membership row is resolved, the caller must also be a
 * live, direct administrator of that member's exact organization; anything
 * else answers 404 exactly as a missing member does, so the route does not
 * disclose that the membership exists. Hierarchy grants nothing. A caller
 * cannot offboard (or toggle) their own membership (409), and reactivating a
 * member who holds an officer role or above is refused (409) until an
 * independent office approval exists to rely on.
 */
import { organizationMembers } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { createLogger } from '@nzila/os-core/telemetry';
import { revokeMemberAccess, reactivateMemberAccess } from '@/lib/services/member-access-revocation-service';
import { isPlatformAdminUser, ROLE_HIERARCHY } from '@/lib/api-auth-guard';
import { directRoleIn, isAdministrativeRole, resolveOrganizationAccess } from '@/lib/organizations/read-authority';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { requirePlatformStaffAuthority } from '@/lib/platform/platform-staff';

const logger = createLogger('union-eyes.admin.users');

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ userId: string }> };

type MemberRecord = { status: string | null; role: string | null; organizationId: string; authUserId: string };

const OFFICER_RANK = ROLE_HIERARCHY.officer;
/**
 * An officer role or above (officer, chief steward, executive, administrator, ...): reactivating one restores privileged office.
 * A role the hierarchy does not know is treated as privileged, so an unrecognised title fails closed.
 */
const isPrivilegedRole = (role: string | null) => {
  const rank = ROLE_HIERARCHY[(role ?? '') as keyof typeof ROLE_HIERARCHY] as number | undefined;
  return rank === undefined || rank >= OFFICER_RANK;
};

/**
 * The caller acts on a membership only as a live, direct administrator of that membership's own organization ('not-found' otherwise,
 * so the refusal does not disclose the membership), and never on their own membership ('self').
 */
async function refusalFor(callerId: string, memberRecord: MemberRecord | undefined): Promise<'not-found' | 'self' | null> {
  if (!memberRecord) return 'not-found';
  const access = await resolveOrganizationAccess(callerId);
  if (!isAdministrativeRole(directRoleIn(access, memberRecord.organizationId))) return 'not-found';
  if (memberRecord.authUserId === callerId) return 'self';
  return null;
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { userId: callerId } = await auth();
  if (!callerId || !(await isPlatformAdminUser(callerId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await requirePlatformStaffAuthority({ userId: callerId, organizationId: await getOrganizationIdForUser(callerId) }, 'platform.user_directory.manage');

  // [userId] route param = organizationMembers.id (membership row), not
  // the target member's own auth user id — see file header.
  const { userId: membershipId } = await params;

  try {
    const memberRecord: MemberRecord | undefined = await withSystemContext(async (tx) => {
      const [record] = await tx
        .select({
          status: organizationMembers.status,
          role: organizationMembers.role,
          organizationId: organizationMembers.organizationId,
          authUserId: organizationMembers.userId,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.id, membershipId))
        .limit(1);
      return record;
    });

    const refusal = await refusalFor(callerId, memberRecord);
    if (refusal === 'not-found' || !memberRecord) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    if (refusal === 'self') {
      return NextResponse.json({ error: 'A member cannot change or remove their own membership' }, { status: 409 });
    }

    const newStatus = memberRecord.status === 'active' ? 'inactive' : 'active';

    // Reactivation symmetrically re-enables the durable auth membership
    // (round 13) — restoring only organization_members.status left a
    // "reactivated" member with a disabled authOrganizationUsers row,
    // failing the canonical role resolver despite a 200 response.
    if (newStatus === 'active') {
      if (isPrivilegedRole(memberRecord.role)) {
        return NextResponse.json({ error: 'Privileged reactivation requires independent office approval' }, { status: 409 });
      }
      const result = await reactivateMemberAccess({
        membershipId,
        authUserId: memberRecord.authUserId,
        organizationId: memberRecord.organizationId,
        actorUserId: callerId,
      });

      if (!result.success) {
        logger.error('member_reactivation_incomplete', { membershipId, errors: result.errors });
        return NextResponse.json(
          { error: 'Failed to fully reactivate member access', details: result.errors },
          { status: 502 },
        );
      }

      return NextResponse.json({ success: true, status: newStatus });
    }

    const result = await revokeMemberAccess({
      membershipId,
      authUserId: memberRecord.authUserId,
      organizationId: memberRecord.organizationId,
      actorUserId: callerId,
      newLocalStatus: 'inactive',
    });

    if (!result.success) {
      logger.error('member_offboarding_incomplete', { membershipId, errors: result.errors });
      return NextResponse.json(
        { error: 'Failed to fully revoke member access', details: result.errors },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    logger.error('member_status_update_failed', { membershipId, error: err });
    return NextResponse.json({ error: 'Failed to update user status' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId: callerId } = await auth();
  if (!callerId || !(await isPlatformAdminUser(callerId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await requirePlatformStaffAuthority({ userId: callerId, organizationId: await getOrganizationIdForUser(callerId) }, 'platform.user_directory.manage');

  // [userId] route param = organizationMembers.id (membership row), not
  // the target member's own auth user id — see file header.
  const { userId: membershipId } = await params;

  try {
    const memberRecord: MemberRecord | undefined = await withSystemContext(async (tx) => {
      const [record] = await tx
        .select({
          status: organizationMembers.status,
          role: organizationMembers.role,
          organizationId: organizationMembers.organizationId,
          authUserId: organizationMembers.userId,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.id, membershipId))
        .limit(1);
      return record;
    });

    const refusal = await refusalFor(callerId, memberRecord);
    if (refusal === 'not-found' || !memberRecord) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    if (refusal === 'self') {
      return NextResponse.json({ error: 'A member cannot change or remove their own membership' }, { status: 409 });
    }

    const result = await revokeMemberAccess({
      membershipId,
      authUserId: memberRecord.authUserId,
      organizationId: memberRecord.organizationId,
      actorUserId: callerId,
      newLocalStatus: 'deleted',
    });

    if (!result.success) {
      logger.error('member_offboarding_incomplete', { membershipId, errors: result.errors });
      return NextResponse.json(
        { error: 'Failed to fully revoke member access', details: result.errors },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('member_delete_failed', { membershipId, error: err });
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
