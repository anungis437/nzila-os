import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@nzila/platform-auth/entra/server";
// NOTE (Wave 0 §3 — semantic demo isolation): The prior implementation
// dynamically imported `@/components/demo/cupe4373-operations-dashboard`
// inside an `isCupe4373DemoRuntime()` branch below. Both the demo module
// and the runtime branch have been removed from the operational build.
// Demo behaviour lives exclusively in the `@nzila/union-eyes-demo`
// artifact (`apps/union-eyes-demo/`) and is not reachable from any code
// path in this application.
import { getUserRole } from "@/lib/auth/rbac-server";
import { UserRole } from "@/lib/auth/roles";
import {
  getRoleLandingPath,
} from "@/lib/dashboard/role-experience";
import { logger } from "@/lib/logger";
import { getOrganizationIdForUser, DEFAULT_ORGANIZATION_ID } from "@/lib/organization-utils";

export const dynamic = "force-dynamic";

type DashboardRootPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Dashboard | UnionEyes",
    description: "Union operations dashboard.",
  };
}

export default async function DashboardRootPage({ params }: DashboardRootPageProps) {
  const { locale } = await params;
  const { userId } = await auth();

  if (!userId) {
    logger.error("[dashboard:root] auth() returned null userId - redirecting to /login", {
      stage: "auth",
      locale,
    });
    redirect("/login");
  }

  let organizationId: string = DEFAULT_ORGANIZATION_ID;
  try {
    organizationId = await getOrganizationIdForUser(userId);
  } catch (error) {
    logger.warn("[dashboard:root] getOrganizationIdForUser threw — falling back to default org", {
      stage: "organization",
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let userRole: UserRole = UserRole.MEMBER;
  try {
    userRole = await getUserRole(userId, organizationId);
  } catch (error) {
    logger.warn("[dashboard:root] getUserRole threw — falling back to member role", {
      stage: "role",
      userId,
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const landingPath = getRoleLandingPath(userRole);

  logger.info("[dashboard:root] resolved role landing — issuing redirect", {
    stage: "redirect",
    userId,
    organizationId,
    userRole,
    landingPath,
    locale,
  });

  redirect(`/${locale}${landingPath}`);
}
