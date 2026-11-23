export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import WorkbenchConsole from "@/components/workbench/workbench-console";
import { canAccessDashboardPath, getDashboardExperience } from "@/lib/dashboard/role-experience";
import { isCaseHandlerRole } from '@/lib/cases/case-role-access';

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
  let currentUser;
  try {
    currentUser = await requireUser();
  } catch {
    redirect("/login");
  }

  const handlerRole = currentUser.roles.find(isCaseHandlerRole);
  if (!handlerRole) {
    redirect("/dashboard");
  }

  const showGrievanceCases = Boolean(currentUser && canAccessDashboardPath(
    '/dashboard/grievances', getDashboardExperience(handlerRole), false,
  ));
  return <WorkbenchConsole showGrievanceCases={showGrievanceCases} />;
}
