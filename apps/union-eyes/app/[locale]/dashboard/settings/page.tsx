/**
 * Dashboard Settings Page
 *
 * Server component that detects the user's role and renders:
 *  - Platform system settings for super-admin roles (app_owner, coo, cto, etc.)
 *  - Organization settings for client-org roles (admin, steward, member, etc.)
 *
 * Both views render inside the same dashboard layout (sidebar + breadcrumb).
 */

export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/auth/rbac-server";
import { getOrganizationIdForUser } from "@/lib/organization-utils";
import PlatformSettingsContent from "./_components/platform-settings-content";
import OrgSettingsContent from "./_components/org-settings-content";

const PLATFORM_ROLES = new Set([
  "app_owner", "coo", "cto",
  "platform_lead", "customer_success_director",
  "support_manager", "data_analytics_manager", "billing_manager",
  "integration_manager", "compliance_manager", "security_manager",
  "support_agent", "data_analyst", "billing_specialist",
  "integration_specialist",
  "content_manager", "training_coordinator",
]);

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) return redirect("/login");

  const organizationId = await getOrganizationIdForUser(userId);
  const userRole = await getUserRole(userId, organizationId);

  if (PLATFORM_ROLES.has(userRole)) {
    return <PlatformSettingsContent />;
  }

  return <OrgSettingsContent />;
}
