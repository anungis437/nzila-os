import { DashboardNavigationProvider, DashboardMenuTrigger } from '@/components/dashboard/navigation-context';
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
import { QcBilingualBanner } from "@/components/compliance/qc-bilingual-banner";
import type { ReactNode } from 'react';
import type { profiles } from '@/db/schema';
import type { UserRole } from '@/lib/auth/roles';
import { DEFAULT_ORGANIZATION_ID } from '@/lib/organization-utils';

/** Shared presentation only. Each route layout retains its own admission checks. */
export function OperationalShell({ children, profile, userEmail, userRole, organizationProvince }: {
  children: ReactNode;
  profile: (typeof profiles.$inferSelect) | null;
  userEmail: string;
  userRole: UserRole;
  organizationProvince: string | null;
}) {
  return (
    <PilotModeProvider>
    <DashboardNavigationProvider>
    <div className="ue-app-shell">
      {/* Credits system disabled — no credit checks needed */}
      {/* Welcome popup disabled — users cannot manage plans or credits */}
        
        {/* Show payment success popup - component handles visibility logic */}
        {profile && <PaymentSuccessPopup profile={profile} />}
        
        {/* Show cancellation popup directly if status is canceled */}
        {profile?.status === "canceled" && (
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
        <div className="ue-app-main">
          {/* QC bilingual banner (Bill 96 / Law 25) */}
          <QcBilingualBanner province={organizationProvince} />
          {/* Organization selector and breadcrumb in header - sticky at top */}
          <div className="ue-global-header">
            <DashboardMenuTrigger />
            <div className="ue-header-context"><OrganizationBreadcrumb /></div>
            <div className="ue-header-controls">
              <LanguageSwitcher />
              <OrganizationSelector />
              <HeaderActions />
            </div>
          </div>
          
          {/* Page content */}
          <main id="main-content" className="dashboard-content">
            <FeatureFlagProvider>
              <RoleExperienceGuard userRole={userRole} />
              {children}
            </FeatureFlagProvider>
          </main>

          {/* First-visit onboarding overlay */}
          <OnboardingProvider userRole={userRole} />
        </div>
      </div>
    </DashboardNavigationProvider>
    </PilotModeProvider>
  );
} 
