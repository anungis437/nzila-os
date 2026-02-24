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

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { UserRole } from "@/lib/auth/roles";
import {
  NzilaOpsDashboard,
  CLCDashboard,
  FederationDashboard,
  UnionDashboard,
} from "@/components/dashboards";

// -- Role-tier classification -------------------------------------------------

/** All Nzila Ventures (app operations) roles */
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

export default function DashboardPage() {
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [tier, setTier] = useState<DashboardTier | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  // Fetch raw RBAC role & classify into tier
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await fetch("/api/auth/user-role");
        if (res.ok) {
          const { role } = await res.json();
          setTier(classifyRole(role));
        } else {
          setTier("union"); // fallback
        }
      } catch {
        setTier("union"); // fallback
      }
    };

    if (user?.id) fetchRole();
  }, [user?.id]);

  // Loading skeleton while we resolve the user and their tier
  if (!mounted || !user || tier === null) {
    return (
      <main className="min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50 p-6 md:p-10">
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
      </main>
    );
  }

  // Render tier-specific dashboard
  switch (tier) {
    case "nzila":
      return <NzilaOpsDashboard />;
    case "clc":
      return <CLCDashboard />;
    case "federation":
      return <FederationDashboard />;
    case "union":
    default:
      return <UnionDashboard />;
  }
}
