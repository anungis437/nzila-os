/**
 * Dashboard layout for Template App
 * This layout removes the global header from all dashboard pages
 * and applies the dashboard-specific styling
 */
import React, { ReactNode } from "react";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import CancellationPopup from "@/components/cancellation-popup";
import PaymentSuccessPopup from "@/components/payment-success-popup";
import { OrganizationSelector } from "@/components/organization/organization-selector";
import { OrganizationBreadcrumb } from "@/components/organization/organization-breadcrumb";
import LanguageSwitcher from "@/components/language-switcher";
import { logger } from "@/lib/logger";
import { getOrganizationIdForUser, DEFAULT_ORGANIZATION_ID } from "@/lib/organization-utils";
import { getUserRole } from "@/lib/auth/rbac-server";
import { db } from "@/db/db";
import { profiles } from "@/db/schema";
import { organizations, organizationMembers } from "@/db/schema-organizations";
import { eq, and } from "drizzle-orm";
// Credits system disabled — platform does not require credits
// import { ExpiredCreditsChecker } from "@/components/billing/expired-credits-checker";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Fetch user profile once at the layout level
  const { userId } = await auth();

  if (!userId) {
    return redirect("/login");
  }

  let profile = (await db.select().from(profiles).where(eq(profiles.userId, userId)))[0] ?? null;

  // Auto-create profile if it doesn&apos;t exist (prevents redirect loop)
  if (!profile) {
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || "";
    
    logger.info(`Auto-creating profile for user ${userId} (${userEmail})`);
    
    try {
      // Create the profile
      const profileData = {
        userId: userId,
        email: userEmail,
      };
      
      await db.insert(profiles).values(profileData);
      
      // Fetch the newly created profile
      profile = (await db.select().from(profiles).where(eq(profiles.userId, userId)))[0] ?? null;
      
      if (!profile) {
        logger.error(`Failed to create profile for user ${userId}`);
        return redirect("/sign-up");
      }
      
      logger.info(`Successfully created profile ${profile.id} for user ${userId}`);
    } catch (error) {
      logger.error(`Error creating profile for user ${userId}:`, error);
      return redirect("/sign-up");
    }
  }

  // Credit check is triggered client-side to avoid blocking the layout render
  
  // Verify profile is still valid after check
  if (!profile) {
    return redirect("/sign-up");
  }

  // Get the current user to extract email
  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || "";

  // Auto-sync Clerk org memberships to local DB if missing
  try {
    const localMemberships = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId))
      .limit(1);

    if (localMemberships.length === 0) {
      const clerk = await clerkClient();
      const clerkOrgs = await clerk.users.getOrganizationMembershipList({ userId, limit: 20 });

      for (const membership of clerkOrgs.data) {
        const clerkOrgId = membership.organization.id;
        // Find matching local org by clerk_organization_id
        const [localOrg] = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.clerkOrganizationId, clerkOrgId))
          .limit(1);

        if (localOrg) {
          // Check no duplicate
          const [existing] = await db
            .select({ id: organizationMembers.id })
            .from(organizationMembers)
            .where(
              and(
                eq(organizationMembers.userId, userId),
                eq(organizationMembers.organizationId, localOrg.id),
              )
            )
            .limit(1);

          if (!existing) {
            const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || userEmail;
            await db.insert(organizationMembers).values({
              userId,
              organizationId: localOrg.id,
              name: fullName,
              email: userEmail,
              role: membership.role.startsWith('org:') ? membership.role.replace('org:', '') : 'member',
              status: 'active',
              isPrimary: clerkOrgs.data.length === 1,
            });
            logger.info(`Auto-synced org membership for ${userId} → ${localOrg.id} (Clerk: ${clerkOrgId})`);
          }
        }
      }
    }
  } catch (syncError) {
    // Non-fatal — user can still access dashboard with fallback org
    logger.warn('Clerk org membership sync failed', syncError);
  }
  
  // Get user's organization and role via proper RBAC chain
  const organizationId = await getOrganizationIdForUser(userId);
  const userRole = await getUserRole(userId, organizationId);
  
  logger.debug('User role resolved via RBAC', {
    userId,
    organizationId,
    role: userRole,
  });
  
  // Log profile details for debugging
  logger.debug('Dashboard profile loaded', {
    userId: profile.userId,
    membership: profile.membership,
    createdAt: profile.createdAt,
    usageCredits: profile.usageCredits,
    userRole: userRole
  });

  return (
    <div className="flex h-screen bg-gray-50 relative overflow-hidden">
      {/* Credits system disabled — no credit checks needed */}
      {/* Welcome popup disabled — users cannot manage plans or credits */}
        
        {/* Show payment success popup - component handles visibility logic */}
        <PaymentSuccessPopup profile={profile} />
        
        {/* Show cancellation popup directly if status is canceled */}
        {profile.status === "canceled" && (
          <CancellationPopup profile={profile} />
        )}
        
        {/* Sidebar component with profile data and user email */}
        <Sidebar 
          profile={profile} 
          userEmail={userEmail} 
          whopMonthlyPlanId={process.env.WHOP_PLAN_ID_MONTHLY || ''}
          whopYearlyPlanId={process.env.WHOP_PLAN_ID_YEARLY || ''}
          userRole={userRole}
          platformOrgId={DEFAULT_ORGANIZATION_ID}
        />
        
        {/* Main content area with organization selector */}
        <div className="flex-1 overflow-auto relative bg-linear-to-br from-slate-50 via-white to-blue-50">
          {/* Organization selector and breadcrumb in header - sticky at top */}
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200/60 px-6 py-4 flex justify-between items-center min-h-15">
            <OrganizationBreadcrumb />
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <OrganizationSelector />
            </div>
          </div>
          
          {/* Page content */}
          <div className="dashboard-content p-6 mt-2">
            {children}
          </div>
        </div>
      </div>
  );
} 
