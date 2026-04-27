/**
 * CLC Labour Intelligence Page (server wrapper)
 * Auth-gated — requires VIEW_CONGRESS_ANALYTICS permission.
 */

import { requireUser } from "@/lib/api-auth-guard";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import CLCIntelligenceConsole from "@/components/clc/clc-intelligence-console";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "clcIntelligencePage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function CLCIntelligencePage() {
  const user = await requireUser();
  const hasAccess = user.permissions.includes("view_congress_analytics");
  if (!hasAccess) {
    redirect("/dashboard");
  }
  return <CLCIntelligenceConsole />;
}
