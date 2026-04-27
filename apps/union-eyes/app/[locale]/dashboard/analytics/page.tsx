/**
 * Analytics Overview Page (server wrapper)
 * Auth-gated — delegates to AnalyticsOverviewConsole client component
 */

import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AnalyticsOverviewConsole } from "@/components/analytics/analytics-overview-console";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "analyticsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AnalyticsPage() {
  await requireUser();
  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }
  const canViewTopPerformers = await hasMinRole("chief_steward");
  return <AnalyticsOverviewConsole canViewTopPerformers={canViewTopPerformers} />;
}
