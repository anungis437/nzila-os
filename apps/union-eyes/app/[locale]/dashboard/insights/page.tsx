"use client";

/**
 * /dashboard/insights — DEPRECATED: soft-redirects to Intelligence (federation tab).
 * Canonical location: /dashboard/intelligence?scope=federation
 */
import { LegacyRedirect } from "@/components/legacy-redirect";
import { useTranslations } from "next-intl";

export default function InsightsPage() {
  const t = useTranslations("legacyRoutes");
  return (
    <LegacyRedirect
      oldName={t("insights.oldName")}
      newName={t("insights.newName")}
      href="/dashboard/intelligence?scope=federation"
    />
  );
}
