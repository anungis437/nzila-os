import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@nzila/platform-auth/entra/server";
import { Cupe4373OperationsDashboard } from "@/components/demo/cupe4373-operations-dashboard";
import { getUserRole } from "@/lib/auth/rbac-server";
import { UserRole } from "@/lib/auth/roles";
import {
  isCupe4373DemoRuntime,
  getRoleLandingPath,
  getDashboardExperience,
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
  if (isCupe4373DemoRuntime()) {
    return {
      title: "Steward Operations Center | UnionEyes",
      description: "CUPE Local 4373 continuity-focused steward operations demo.",
    };
  }
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

  if (isCupe4373DemoRuntime()) {
    // Demo runtime: scope landing by role so members don't see the steward
    // operations console. Stewards / officers / executives / admins keep the
    // CUPE 4373 ops dashboard; members land on their intake inbox (which is in
    // their 4-item nav: Dashboard, Inbox, My Cases, Documents).
    let demoOrganizationId: string = DEFAULT_ORGANIZATION_ID;
    try {
      demoOrganizationId = await getOrganizationIdForUser(userId);
    } catch (error) {
      logger.warn("[dashboard:root] demo getOrganizationIdForUser threw — using default org", {
        stage: "demo-organization",
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    let demoUserRole: UserRole = UserRole.MEMBER;
    try {
      demoUserRole = await getUserRole(userId, demoOrganizationId);
    } catch (error) {
      logger.warn("[dashboard:root] demo getUserRole threw — falling back to member role", {
        stage: "demo-role",
        userId,
        organizationId: demoOrganizationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const demoExperience = getDashboardExperience(demoUserRole);
    if (demoExperience === 'member') {
      logger.info("[dashboard:root] demo member — redirecting to intake inbox", {
        stage: "demo-redirect",
        userId,
        organizationId: demoOrganizationId,
        userRole: demoUserRole,
        locale,
      });
      redirect(`/${locale}/dashboard/inbox`);
    }

    return <Cupe4373OperationsDashboard locale={locale} />;
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
