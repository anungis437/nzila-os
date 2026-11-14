export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole, getCurrentUser } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import WorkbenchConsole from "@/components/workbench/workbench-console";
import { canAccessDashboardPath, getDashboardExperience } from "@/lib/dashboard/role-experience";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "workbenchPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function WorkbenchPage() {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  const currentUser = await getCurrentUser();
  const showGrievanceCases = Boolean(currentUser && canAccessDashboardPath(
    '/dashboard/grievances', getDashboardExperience(currentUser.role), false,
  ));
  return <WorkbenchConsole showGrievanceCases={showGrievanceCases} />;
}
