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

export default async function WorkPage() {
  const user = await requireUser();
  if (!user) redirect("/sign-in");
  const authorized = await hasMinRole("steward");
  if (!authorized) redirect("/dashboard/inbox");

  return <WorkSurface />;
}
