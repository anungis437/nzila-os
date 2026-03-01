import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { getUserRole } from '@/lib/auth/rbac-server';
import { getOrganizationIdForUser } from '@/lib/organization-utils';

/**
 * Debug endpoint — remove before production.
 * GET /api/auth/debug-role
 *
 * Returns the current user's Clerk ID, public metadata, resolved role,
 * and whether PLATFORM_ADMIN_USER_IDS includes this user.
 */
export async function GET() {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = user.id;
  const organizationId = await getOrganizationIdForUser(userId);
  const resolvedRole = await getUserRole(userId, organizationId);

  const adminIds = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return NextResponse.json({
    userId,
    organizationId,
    resolvedRole,
    clerkMetadata: {
      role: user.publicMetadata?.role ?? null,
      nzilaRole: user.publicMetadata?.nzilaRole ?? null,
    },
    inPlatformAdminEnvVar: adminIds.includes(userId),
    platformAdminUserIds: adminIds,
  });
}
