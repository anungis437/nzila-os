/**
 * Dashboard layout for Template App
 * This layout removes the global header from all dashboard pages
 * and applies the dashboard-specific styling
 */
import React, { ReactNode } from "react";
import { auth, currentUser } from '@nzila/platform-auth/entra/server';
import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import CancellationPopup from "@/components/cancellation-popup";
import PaymentSuccessPopup from "@/components/payment-success-popup";
import { OrganizationSelector } from "@/components/organization/organization-selector";
import { OrganizationBreadcrumb } from "@/components/organization/organization-breadcrumb";
import LanguageSwitcher from "@/components/language-switcher";
import { HeaderActions } from "@/components/header-actions";
import RoleExperienceGuard from "@/components/dashboard/role-experience-guard";
import { PilotModeProvider } from "@/contexts/pilot-mode-context";
import { FeatureFlagProvider } from "@/lib/hooks/use-feature-flags";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { logger } from "@/lib/logger";
import { getOrganizationIdForUser, DEFAULT_ORGANIZATION_ID } from "@/lib/organization-utils";
import { getUserRole } from "@/lib/auth/rbac-server";
import { db } from "@/db/db";
import { profiles } from "@/db/schema";
import { organizationMembers } from "@/db/schema-organizations";
import { organizations } from "@/db/schema-organizations";
import { eq, sql } from "drizzle-orm";
import { QcBilingualBanner } from "@/components/compliance/qc-bilingual-banner";
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

    // If this is a new Entra object ID for an existing person, link profile by email
    // before creating a duplicate profile row.
    if (userEmail) {
      const existingByEmail = await db
        .select()
        .from(profiles)
        .where(sql`lower(${profiles.email}) = lower(${userEmail})`)
        .limit(1);

      if (existingByEmail.length > 0) {
        await db
          .update(profiles)
          .set({ userId })
          .where(eq(profiles.id, existingByEmail[0].id));

        profile = (await db.select().from(profiles).where(eq(profiles.userId, userId)))[0] ?? null;

        logger.info(`Linked existing profile by email for user ${userId}`, {
          email: userEmail,
          profileId: existingByEmail[0].id,
        });
      }
    }

    if (profile) {
      // Profile was linked successfully; skip auto-create path.
    } else {
    
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
  }

  // Credit check is triggered client-side to avoid blocking the layout render
  
  // Verify profile is still valid after check
  if (!profile) {
    return redirect("/sign-up");
  }

  // Get the current user to extract email
  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || "";

  // Auto-provision org membership if user has none.
  // With Entra auth, new users get a profile but no organization_members row.
  // Without a membership, all org-scoped API routes reject with 403.
  try {
    let localMemberships = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId))
      .limit(1);

    // If this Entra user has no membership yet, try linking seeded/demo rows
    // by email so users like alice.johnson@city.toronto.ca resolve to Local 123
    // instead of being auto-provisioned into the default org.
    if (localMemberships.length === 0 && userEmail) {
      const emailMemberships = await db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(eq(organizationMembers.email, userEmail))
        .limit(50);

      if (emailMemberships.length > 0) {
        await db
          .update(organizationMembers)
          .set({ userId })
          .where(eq(organizationMembers.email, userEmail));

        localMemberships = await db
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(eq(organizationMembers.userId, userId))
          .limit(1);

        logger.info(`Linked existing org membership(s) by email for user ${userId}`, {
          email: userEmail,
          linkedCount: emailMemberships.length,
        });
      }
    }

    if (localMemberships.length === 0) {
      const userName = user?.fullName ?? user?.firstName ?? userEmail.split('@')[0] ?? 'Member';
      logger.info(`Auto-provisioning org membership for user ${userId} in default org`);
      try {
        await db.insert(organizationMembers).values({
          userId,
          organizationId: DEFAULT_ORGANIZATION_ID,
          name: userName,
          email: userEmail,
          role: 'member',
          status: 'active',
          isPrimary: true,
        });
        logger.info(`Created org membership for ${userId} in ${DEFAULT_ORGANIZATION_ID}`);
      } catch (insertErr) {
        // Unique constraint race — another request may have created it
        logger.warn('Org membership insert failed (may already exist)', insertErr);
      }
    }
  } catch (syncError) {
    // Non-fatal — user can still access dashboard with fallback org
    logger.warn('Org membership sync failed', syncError);
  }
  
  // Get user's organization and role via proper RBAC chain
  const organizationId = await getOrganizationIdForUser(userId);
  const userRole = await getUserRole(userId, organizationId);

  // Fetch organization province for QC bilingual banner (Bill 96 / Law 25)
  let organizationProvince: string | null = null;
  if (organizationId) {
    try {
      const orgRow = (await db
        .select({ provinceTerritory: organizations.provinceTerritory })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1))[0];
      organizationProvince = orgRow?.provinceTerritory ?? null;
    } catch (err) {
      logger.warn('Failed to fetch organization province for QC banner', err);
    }
  }
  
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
    <PilotModeProvider>
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
        <div className="flex-1 min-w-0 overflow-auto relative bg-linear-to-br from-slate-50 via-white to-blue-50">
          {/* QC bilingual banner (Bill 96 / Law 25) */}
          <QcBilingualBanner province={organizationProvince} />
          {/* Organization selector and breadcrumb in header - sticky at top */}
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200/60 px-3 md:px-6 py-2.5 md:py-4 flex justify-between items-center gap-2 min-h-12 md:min-h-15">
            <OrganizationBreadcrumb />
            <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
              <LanguageSwitcher />
              <OrganizationSelector />
              <HeaderActions />
            </div>
          </div>
          
          {/* Page content */}
          <div className="dashboard-content p-3 md:p-6 mt-1 md:mt-2">
            <FeatureFlagProvider>
              <RoleExperienceGuard userRole={userRole} />
              {children}
            </FeatureFlagProvider>
          </div>

          {/* First-visit onboarding overlay */}
          <OnboardingProvider userRole={userRole} />
        </div>
      </div>
    </PilotModeProvider>
  );
} 
