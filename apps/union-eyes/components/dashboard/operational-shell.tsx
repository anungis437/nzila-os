import { DashboardNavigationProvider, DashboardMenuTrigger } from '@/components/dashboard/navigation-context';
import Sidebar from "@/components/sidebar";
import { OrganizationSelector } from "@/components/organization/organization-selector";
import { OrganizationBreadcrumb } from "@/components/organization/organization-breadcrumb";
import LanguageSwitcher from "@/components/language-switcher";
import { HeaderActions } from "@/components/header-actions";
import RoleExperienceGuard from "@/components/dashboard/role-experience-guard";
import { PilotModeProvider } from "@/contexts/pilot-mode-context";
import PilotFeedbackWidget from "@/components/pilot/pilot-feedback-widget";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { QcBilingualBanner } from "@/components/compliance/qc-bilingual-banner";
import type { ReactNode } from 'react';
import type { UserRole } from '@/lib/auth/roles';
import { DEFAULT_ORGANIZATION_ID } from '@/lib/organization-utils';

/** Shared presentation only. Each route layout retains its own admission checks. */
export function OperationalShell({ children, userEmail, userRole, organizationProvince }: {
  children: ReactNode;
  userEmail: string;
  userRole: UserRole;
  organizationProvince: string | null;
}) {
  return (
    <PilotModeProvider>
    <DashboardNavigationProvider>
    <div className="ue-app-shell">
        {/* Sidebar component with the signed-in user's email */}
        <Sidebar 
          userEmail={userEmail} 
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
              <HeaderActions userRole={userRole} />
            </div>
          </div>
          
          {/* Page content */}
          <main id="main-content" className="dashboard-content">
            <RoleExperienceGuard userRole={userRole} />
            {children}
          </main>

          {/* First-visit onboarding overlay */}
          <OnboardingProvider userRole={userRole} />

          {/* Pilot feedback prompt: shown only in pilot mode, after the first case and at the usage milestone */}
          <PilotFeedbackWidget />
        </div>
      </div>
    </DashboardNavigationProvider>
    </PilotModeProvider>
  );
} 
