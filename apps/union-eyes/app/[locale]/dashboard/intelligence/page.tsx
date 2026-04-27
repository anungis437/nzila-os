/**
 * /dashboard/intelligence — Research, analysis, and insights shell.
 *
 * Tabbed view role-scoped via query param:
 *   ?scope=local      → Local analytics (default)
 *   ?scope=federation  → Movement/federation insights
 *   ?scope=executive   → Executive dashboard + strategic planning
 *
 * Tab visibility is controlled by component-level role checks.
 * Auth: steward+ to view any intelligence.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { IntelligenceShell } from "@/components/intelligence/intelligence-shell";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "intelligencePage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function IntelligencePage() {
  const user = await requireUser();
  if (!user) redirect("/sign-in");
  const authorized = await hasMinRole("steward");
  if (!authorized) redirect("/dashboard/inbox");

  const userRole = user.roles?.[0] || "steward";

  return <IntelligenceShell userRole={userRole} />;
}
