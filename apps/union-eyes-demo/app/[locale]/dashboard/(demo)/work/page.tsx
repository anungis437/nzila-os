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
import { requireUser } from "@/lib/api-auth-guard";
import { Cupe4373CasesConsole } from "@/components/demo/cupe4373-cases-console";

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
  try {
    await requireUser();
  } catch {
    redirect(`/${locale}/login`);
  }
  // Demo build: every authenticated user sees the demo work surface.
  return <Cupe4373CasesConsole />;
}
