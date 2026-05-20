import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@nzila/platform-auth/entra/server";
import { Cupe4373OperationsDashboard } from "@/components/demo/cupe4373-operations-dashboard";
import { PortalHome } from "@/components/home/portal-home";
import { isCupe4373DemoRuntime } from "@/lib/dashboard/role-experience";
import { logger } from "@/lib/logger";

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
    return <Cupe4373OperationsDashboard locale={locale} />;
  }

  return <PortalHome locale={locale} displayName="" email="" isCupeDemo={false} />;
}
