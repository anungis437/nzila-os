import { NextResponse } from 'next/server';
import { auth, currentUser } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { profiles } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getOrganizationIdForUser, getOrganizationInfo } from '@/lib/organization-utils';
import { getUserRole } from '@/lib/auth/rbac-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await currentUser();
  const userEmail =
    user?.emailAddresses?.[0]?.emailAddress?.trim()
    || user?.primaryEmailAddress?.emailAddress?.trim()
    || '';

  let profile = (await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1))[0] ?? null;

  // Link legacy profile row by email if userId changed.
  if (!profile && userEmail) {
    const byEmail = await db
      .select()
      .from(profiles)
      .where(sql`lower(${profiles.email}) = lower(${userEmail})`)
      .limit(1);

    if (byEmail.length > 0) {
      await db
        .update(profiles)
        .set({ userId })
        .where(eq(profiles.id, byEmail[0].id));

      profile = (await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1))[0] ?? null;
    }
  }

  const organizationId = await getOrganizationIdForUser(userId);
  const organization = organizationId ? await getOrganizationInfo(organizationId) : null;
  const role = organizationId ? await getUserRole(userId, organizationId) : 'member';

  const fullName =
    user?.fullName
    || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
    || (userEmail ? userEmail.split('@')[0] : '');

  return NextResponse.json({
    user: {
      id: userId,
      name: fullName,
      email: userEmail,
      phone: user?.primaryPhoneNumber?.phoneNumber ?? '',
    },
    profile: profile
      ? {
          id: profile.id,
          membership: profile.membership,
          status: profile.status,
          usageCredits: profile.usageCredits,
        }
      : null,
    organization: organization
      ? {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          type: organization.type,
        }
      : null,
    role: role ?? 'member',
  });
}
