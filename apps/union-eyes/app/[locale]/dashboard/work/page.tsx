/**
 * /dashboard/work — Consolidated work surface.
 *
 * Tabbed view combining all active-work streams:
 *   • Cases  — WorkbenchConsole (case queue)
 *   • Grievances — GrievancesConsole
 *   • Bargaining — NegotiationDashboard
 *
 * Auth: steward+ (reps and above handle active casework).
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { WorkSurface } from "@/components/work/work-surface";
import { Cupe4373CasesConsole } from "@/components/demo/cupe4373-cases-console";
import { isCupe4373DemoRuntime } from "@/lib/dashboard/role-experience";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "workPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function WorkPage({ params }: PageProps) {
  const { locale } = await params;
  const user = await requireUser();
  if (!user) redirect(`/${locale}/sign-in`);
  const authorized = await hasMinRole("steward");
  if (!authorized) redirect(`/${locale}/dashboard/inbox`);

  if (isCupe4373DemoRuntime()) {
    return <Cupe4373CasesConsole />;
  }

  return <WorkSurface />;
}
