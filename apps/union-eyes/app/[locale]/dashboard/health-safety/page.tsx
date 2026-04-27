/**
 * Health & Safety Dashboard - Server Component Gate
 * 
 * Restricts the H&S dashboard to health_safety_rep role and above.
 * Regular members can still report incidents via /incidents/new.
 * 
 * @page app/[locale]/dashboard/health-safety/page.tsx
 */

export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import HealthSafetyOverview from "@/components/health-safety/HealthSafetyOverview";
import { checkModuleEntitlement } from "@/services/platform-economics/entitlement-guard";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "healthSafetyPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function HealthSafetyPage() {
  const user = await requireUser();

  const hasAccess = await hasMinRole("health_safety_rep");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Premium feature — not available in pilot
  const entitlement = await checkModuleEntitlement(user.organizationId, 'health_safety');
  if (!entitlement.allowed) {
    redirect("/dashboard");
  }

  return <HealthSafetyOverview />;
}
