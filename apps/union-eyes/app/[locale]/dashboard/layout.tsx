import { OperationalShell } from '@/components/dashboard/operational-shell';
import { RetiredCapabilityNotice } from '@/components/system/retired-capability-notice';
/**
 * Dashboard layout for Union Eyes
 * This layout removes the global header from all dashboard pages
 * and applies the dashboard-specific styling
 */
import React, { ReactNode } from "react";
import { auth, currentUser } from '@nzila/platform-auth/entra/server';
import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";
import { getOrganizationIdForUser, DEFAULT_ORGANIZATION_ID } from "@/lib/organization-utils";
import { getUserRole } from "@/lib/auth/rbac-server";
import { UserRole } from "@/lib/auth/roles";
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';
import { getCanonicalOrganizationContext } from '@/lib/auth/canonical-context';
import { isDeployedRuntime } from '@/lib/runtime/production-guard';
import {
  ensureOrganizationMembership,
  isSeedMembershipLinkingAllowed,
  loadOrCreateProfile,
  readOrganizationProvince,
} from '@/lib/dashboard/layout-bootstrap';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Fetch user profile once at the layout level
  const { userId } = await auth();

  if (!userId) {
    logger.error('[dashboard:identity] auth() returned null userId — redirecting to /login', {
      stage: 'auth',
      hasSessionCookie: undefined,
    });
    return redirect("/login");
  }

  if (currentStateContextEnabled()) {
    // Canonical membership is live authority. The legacy billing profile is not an
    // identity prerequisite, and email must never relink a profile or membership.
    const context = await getCanonicalOrganizationContext({ expectedActorUserId: userId });
    const organizationProvince = await readOrganizationProvince(context.organizationId);
    return <OperationalShell userEmail={context.email}
      userRole={context.role} organizationProvince={organizationProvince}>{children}<RetiredCapabilityNotice /></OperationalShell>;
  }

  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || "";

  // The person's profile row is the identity anchor other records reference (cookie consent, push devices). It is read, and created on
  // the first visit (which prevents a redirect loop), in the person's own user context; nothing from it is sent to the browser.
  // A database failure is an error, not a reason to send the person to sign up.
  if (!(await loadOrCreateProfile({ userId, email: userEmail }))) {
    logger.error(`Failed to create profile for user ${userId}`);
    return redirect("/sign-up");
  }

  // Auto-provision org membership if user has none.
  // With Entra auth, new users get a profile but no organization_members row.
  // Without a membership, all org-scoped API routes reject with 403.
  //
  // Auto-provisioning into the default org is only permitted off a deployment (a developer's machine, a test run). A deployed runtime
  // (NODE_ENV=production, or any production/staging/pilot identity) never auto-provisions, whatever the environment says: a user without an
  // organisation membership is directed to the access-request flow (lib/runtime/production-guard.ts).
  const allowAutoProvisioning = !isDeployedRuntime();
  const membership = await ensureOrganizationMembership({
    userId,
    email: userEmail,
    name: user?.fullName ?? user?.firstName ?? userEmail.split('@')[0] ?? 'Member',
    defaultOrganizationId: DEFAULT_ORGANIZATION_ID,
    allowAutoProvisioning,
    // The session's e-mail is not verified, so a membership is never handed over by e-mail in production (see isSeedMembershipLinkingAllowed).
    linkSeededMemberships: isSeedMembershipLinkingAllowed(),
  });
  if (membership === 'none') {
    logger.warn(`[dashboard:layout] User ${userId} has no org membership — redirecting to /pilot-request`);
    return redirect('/pilot-request');
  }
  if (membership !== 'existing') {
    logger.info(`Org membership ${membership} for user ${userId}`, { email: userEmail });
  }

  // The organization and the role come from the RBAC chain. A lookup that fails is an error: it is not a reason to show the default
  // organization's notices or the member experience to someone whose organization or role could not be read.
  const organizationId: string = await getOrganizationIdForUser(userId);
  const userRole: UserRole = await getUserRole(userId, organizationId);

  if (!organizationId) {
    logger.error('[dashboard:identity] getOrganizationIdForUser returned no organizationId', {
      stage: 'organization',
      userId,
      userEmail,
    });
  }
  if (!userRole) {
    logger.error('[dashboard:identity] getUserRole returned no role', {
      stage: 'role',
      userId,
      organizationId,
    });
  }

  // Fetch organization province for QC bilingual banner (Bill 96 / Law 25). A failed read is an error: the banner is a legal notice and
  // must not disappear silently.
  const organizationProvince = organizationId ? await readOrganizationProvince(organizationId) : null;

  logger.debug('User role resolved via RBAC', {
    userId,
    organizationId,
    role: userRole,
  });

  return <OperationalShell userEmail={userEmail}
    userRole={userRole} organizationProvince={organizationProvince}>{children}<RetiredCapabilityNotice /></OperationalShell>;
}
