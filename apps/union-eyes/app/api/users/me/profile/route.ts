import { NextResponse } from 'next/server';
import { auth, currentUser } from '@nzila/platform-auth/entra/server';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getOrganizationIdForUser, getOrganizationInfo } from '@/lib/organization-utils';
import { getUserRole } from '@/lib/auth/rbac-server';
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';
import { withRLSContext } from '@/lib/db/with-rls-context';

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

  // A profile belongs to a person, not to an organization: it is read in the person's own user context ('system' keeps the authenticated
  // user and clears the organization). Row-level security (user_id = app.current_user_id) then returns exactly this person's profile.
  // A profile is never relinked to this person by e-mail address: the provider can return an unverified address, a profile row may carry
  // any address, and moving a row between user ids would hand one person another's profile (the canonical branch above has no such link either).
  const profile = await withRLSContext({ organizationId: 'system', userId }, async (tx) =>
    (await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1))[0] ?? null);

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
    profile: profile ? { id: profile.id } : null,
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
