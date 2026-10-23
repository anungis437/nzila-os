import React from 'react';
import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from 'next/navigation';
import { OperationalShell } from '@/components/dashboard/operational-shell';
import { UserRole } from '@/lib/auth/roles';
import { OfflineBanner } from '@/components/mobile/OfflineBanner';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { getUserRole } from '@/lib/auth/rbac-server';
import { logger } from '@/lib/logger';

/**
 * Mobile-specific layout wrapper.
 *
 * Resolves the current user's role via the canonical RBAC chain
 * (`auth() → getOrganizationIdForUser → getUserRole`) so the bottom
 * navigation can be driven from the role-experience SOT instead of a
 * hard-coded item list.
 *
 * Note: this layout is a *sibling* of `/dashboard` (not a child), so it
 * intentionally does NOT duplicate the dashboard layout's profile and
 * organization-membership auto-provisioning. Users normally land on the
 * dashboard first, where that bootstrap runs; the mobile surface only
 * needs enough context to render role-correct navigation.
 */
export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    return redirect('/login');
  }

  let userRole: UserRole = UserRole.MEMBER;
  try {
    const organizationId = await getOrganizationIdForUser(userId);
    const role = await getUserRole(userId, organizationId);
    userRole = role ?? UserRole.MEMBER;
  } catch (error) {
    logger.warn('[mobile:layout] role resolution failed; defaulting to member experience', error);
  }

  return (
    <OperationalShell profile={null} userEmail="" userRole={userRole} organizationProvince={null}>
      <OfflineBanner className="static z-auto mb-4" />
      {children}
    </OperationalShell>
  );
}
