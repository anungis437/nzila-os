"use client";


export const dynamic = 'force-dynamic';
/**
 * Dashboard Page - Role-Based Switcher
 *
 * Detects the authenticated user's RBAC role and renders the appropriate
 * dashboard variant:
 *
 *   Nzila Ventures roles  -> NzilaOpsDashboard  (platform operations)
 *   CLC national roles    -> CLCDashboard       (congress-level)
 *   Federation roles      -> FederationDashboard (provincial federation)
 *   Union / Local roles   -> UnionDashboard      (original - preserved as-is)
 */

import { useUser } from '@nzila/platform-auth/entra/client';
import { useEffect, useState } from "react";
import { UserRole } from "@/lib/auth/roles";
import { useOrganization } from "@/contexts/organization-context";
import { usePilotMode } from "@/contexts/pilot-mode-context";
import {
  NzilaOpsDashboard,
  CLCDashboard,
  FederationDashboard,
  UnionDashboard,
} from "@/components/dashboards";
import PilotDashboard from "@/components/dashboards/pilot-dashboard";
import PilotOnboardingWizard from "@/components/onboarding/pilot-onboarding-wizard";
import { PilotHelpTooltip } from "@/components/pilot/pilot-help-tooltip";

// -- Role-tier classification -------------------------------------------------

/** All Nzila Ventures (app operations) roles + org-admin */
const NZILA_ROLES: string[] = [
  UserRole.APP_OWNER,
  UserRole.COO,
  UserRole.CTO,
  UserRole.PLATFORM_LEAD,
  UserRole.CUSTOMER_SUCCESS_DIRECTOR,
  UserRole.SUPPORT_MANAGER,
  UserRole.DATA_ANALYTICS_MANAGER,
  UserRole.BILLING_MANAGER,
  UserRole.INTEGRATION_MANAGER,
  UserRole.COMPLIANCE_MANAGER,
  UserRole.SECURITY_MANAGER,
  UserRole.SUPPORT_AGENT,
  UserRole.DATA_ANALYST,
  UserRole.BILLING_SPECIALIST,
  UserRole.INTEGRATION_SPECIALIST,
  UserRole.CONTENT_MANAGER,
  UserRole.TRAINING_COORDINATOR,
  UserRole.SYSTEM_ADMIN,
];

/** CLC (Congress) level roles */
const CLC_ROLES: string[] = [
  UserRole.CLC_EXECUTIVE,
  UserRole.CLC_STAFF,
  UserRole.CONGRESS_STAFF, // legacy alias
];

/** Provincial federation roles */
const FED_ROLES: string[] = [
  UserRole.FED_EXECUTIVE,
  UserRole.FED_STAFF,
  UserRole.FEDERATION_STAFF, // legacy alias
];

type DashboardTier = "nzila" | "clc" | "federation" | "union";

function classifyRole(role: string): DashboardTier {
  if (NZILA_ROLES.includes(role)) return "nzila";
  if (CLC_ROLES.includes(role)) return "clc";
  if (FED_ROLES.includes(role)) return "federation";
  return "union";
}

// -- Main Page Component ------------------------------------------------------

/** Map organization type to dashboard tier */
function orgTypeToDashboardTier(orgType: string | undefined): DashboardTier {
  switch (orgType) {
    case "platform": return "nzila";
    case "congress": return "clc";
    case "federation": return "federation";
    default: return "union";
  }
}

export default function DashboardPage() {
  const { user } = useUser();
  const { organizationId, organization, isLoading: orgLoading } = useOrganization();
  const { isPilotMode, hasCompletedOnboarding } = usePilotMode();
  const [mounted, setMounted] = useState(false);
  const [tier, setTier] = useState<DashboardTier | null>(null);
  const [isPlatformViewer, setIsPlatformViewer] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  // Fetch raw RBAC role & classify into tier, then override when
  // a platform admin is viewing another org.
  // Wait for org context to finish loading to avoid flash of wrong dashboard.
  useEffect(() => {
    if (!user?.id || orgLoading) return;

    const fetchRole = async () => {
      try {
        const res = await fetch("/api/auth/user-role");
        if (res.ok) {
          const { role } = await res.json();
          const roleTier = classifyRole(role);

          // Platform admin viewing a non-platform org → show that org's dashboard
          // with admin context
          if (roleTier === "nzila" && organizationId && organization) {
            const platformRes = await fetch("/api/organizations/platform-id");
            if (platformRes.ok) {
              const { platformOrgId } = await platformRes.json();
              if (organizationId !== platformOrgId) {
                setIsPlatformViewer(true);
                setTier(orgTypeToDashboardTier(organization.type));
                return;
              }
            }
          }

          setIsPlatformViewer(false);
          setTier(roleTier);
        } else {
          setTier("union"); // fallback
        }
      } catch {
        setTier("union"); // fallback
      }
    };

    fetchRole();
  }, [user?.id, organizationId, organization, orgLoading]);

  // Loading skeleton while we resolve the user and their tier
  if (!mounted || !user || tier === null || orgLoading) {
    return (
      <div className="p-6 md:p-10">
        <div className="animate-pulse space-y-6">
          <div className="h-24 bg-gray-200 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-gray-200 rounded-lg" />
            <div className="h-96 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Pilot onboarding wizard — show on first visit for union-tier pilot users
  const shouldShowOnboarding = isPilotMode && tier === "union" && !isPlatformViewer && !hasCompletedOnboarding;

  // Platform admin viewing org — show admin banner + org dashboard
  const adminBanner = isPlatformViewer && organization ? (
    <div className="mx-6 mt-6 mb-0 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <span>
        <strong>Platform Admin View</strong> — You are viewing <strong>{organization.name}</strong> as a platform administrator.
        This is an oversight view, not a membership view.
      </span>
    </div>
  ) : null;

  // Render tier-specific dashboard
  const dashboard = (() => {
    switch (tier) {
      case "nzila":
        return <NzilaOpsDashboard />;
      case "clc":
        return <CLCDashboard isPlatformViewer={isPlatformViewer} />;
      case "federation":
        return <FederationDashboard isPlatformViewer={isPlatformViewer} />;
      case "union":
      default:
        return isPilotMode && !isPlatformViewer
          ? <PilotDashboard />
          : <UnionDashboard isPlatformViewer={isPlatformViewer} />;
    }
  })();

  return (
    <>
      {shouldShowOnboarding && (
        <PilotOnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
      {adminBanner}
      {dashboard}
      {isPilotMode && tier === "union" && !isPlatformViewer && (
        <PilotHelpTooltip helpKey="dashboardHelp" />
      )}
    </>
  );
}
