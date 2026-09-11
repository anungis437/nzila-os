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
 * PLATFORM_ADMIN_USER_IDS below) has no ordinary tenant RLS context for
 * an arbitrary target organization, so execution must be under the
 * system role, not the tenant runtime role. The PLATFORM_ADMIN_USER_IDS
 * check itself stays OUTSIDE/BEFORE withSystemContext — the authorization
 * decision is made on the caller's real identity before any system-
 * privileged execution begins.
 */
import { organizationMembers } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { createLogger } from '@nzila/os-core/telemetry';
import { revokeMemberAccess, reactivateMemberAccess } from '@/lib/services/member-access-revocation-service';

const logger = createLogger('union-eyes.admin.users');

export const dynamic = 'force-dynamic';

function isPlatformAdmin(userId: string): boolean {
  const ids = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return ids.includes(userId);
}

type Params = { params: Promise<{ userId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { userId: callerId } = await auth();
  if (!callerId || !isPlatformAdmin(callerId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // [userId] route param = organizationMembers.id (membership row), not
  // the target member's own auth user id — see file header.
  const { userId: membershipId } = await params;

  try {
    const memberRecord = await withSystemContext(async (tx) => {
      const [record] = await tx
        .select({
          status: organizationMembers.status,
          organizationId: organizationMembers.organizationId,
          authUserId: organizationMembers.userId,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.id, membershipId))
        .limit(1);
      return record;
    });

    if (!memberRecord) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const newStatus = memberRecord.status === 'active' ? 'inactive' : 'active';

    // Reactivation symmetrically re-enables the durable auth membership
    // (round 13) — restoring only organization_members.status left a
    // "reactivated" member with a disabled authOrganizationUsers row,
    // failing the canonical role resolver despite a 200 response.
    if (newStatus === 'active') {
      const result = await reactivateMemberAccess({
        membershipId,
        authUserId: memberRecord.authUserId,
        organizationId: memberRecord.organizationId,
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
  if (!callerId || !isPlatformAdmin(callerId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // [userId] route param = organizationMembers.id (membership row), not
  // the target member's own auth user id — see file header.
  const { userId: membershipId } = await params;

  try {
    const memberRecord = await withSystemContext(async (tx) => {
      const [record] = await tx
        .select({
          status: organizationMembers.status,
          organizationId: organizationMembers.organizationId,
          authUserId: organizationMembers.userId,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.id, membershipId))
        .limit(1);
      return record;
    });

    if (!memberRecord) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const result = await revokeMemberAccess({
      membershipId,
      authUserId: memberRecord.authUserId,
      organizationId: memberRecord.organizationId,
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


