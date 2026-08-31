import React from 'react';
import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from 'next/navigation';
import { BottomNav } from '@/components/mobile/BottomNav';
import { OfflineBanner } from '@/components/mobile/OfflineBanner';
import { PilotModeProvider } from '@/contexts/pilot-mode-context';
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

  let userRole: string | undefined;
  try {
    const organizationId = await getOrganizationIdForUser(userId);
    const role = await getUserRole(userId, organizationId);
    userRole = role ?? undefined;
  } catch (error) {
    logger.warn('[mobile:layout] role resolution failed; defaulting to member experience', error);
  }

  return (
    <PilotModeProvider>
      <div className="min-h-screen bg-gray-50 pb-20">
        <OfflineBanner />
        <main className="min-h-screen">
          {children}
        </main>
        <BottomNav userRole={userRole} />
      </div>
    </PilotModeProvider>
  );
}
