import { NextResponse } from 'next/server';
import { auth, currentUser } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { profiles } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getOrganizationIdForUser, getOrganizationInfo } from '@/lib/organization-utils';
import { getUserRole } from '@/lib/auth/rbac-server';
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (currentStateContextEnabled()) {
    // Canonical V2: identity and organization come from the private actor and active membership
    // choices; there is no email-based profile linking and no bare database connection.
    const { getCanonicalOrganizationChoices, canonicalOrganizationError } = await import(
      '@/lib/auth/canonical-organization-selection'
    );
    try {
      const choices = await getCanonicalOrganizationChoices();
      const active = choices.activeOrganizationId;
      const organization = choices.organizations.find((entry) => entry.id === active) ?? null;
      const membership = choices.memberships.find((entry) => entry.organizationId === active) ?? null;
      // The caller's own session identity only; this is not an email-based lookup of any profile row.
      const sessionUser = await currentUser().catch(() => null);
      const sessionEmail =
        sessionUser?.primaryEmailAddress?.emailAddress?.trim()
        || sessionUser?.emailAddresses?.[0]?.emailAddress?.trim()
        || '';
      const sessionName =
        sessionUser?.fullName
        || `${sessionUser?.firstName || ''} ${sessionUser?.lastName || ''}`.trim()
        || (sessionEmail ? sessionEmail.split('@')[0] : '');
      return NextResponse.json({
        user: {
          id: membership?.userId ?? null,
          name: sessionName,
          email: sessionEmail,
          phone: sessionUser?.primaryPhoneNumber?.phoneNumber ?? '',
        },
        profile: null,
        organization: organization
          ? {
              id: organization.id,
              name: organization.name,
              slug: organization.slug,
              type: organization.type,
            }
          : null,
        role: membership?.role ?? 'member',
        organizationAuthority: choices.organizationAuthority,
      });
    } catch (error) {
      return canonicalOrganizationError(error, 'load profile for');
    }
  }

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
