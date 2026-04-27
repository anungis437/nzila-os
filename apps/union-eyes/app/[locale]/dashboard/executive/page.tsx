"use client";

/**
 * /dashboard/executive — DEPRECATED: soft-redirects to Intelligence (executive tab).
 * Canonical location: /dashboard/intelligence?scope=executive
 */
import { LegacyRedirect } from "@/components/legacy-redirect";
import { useTranslations } from "next-intl";

export default function ExecutiveDashboardPage() {
  const t = useTranslations("legacyRoutes");
  return (
    <LegacyRedirect
      oldName={t("executive.oldName")}
      newName={t("executive.newName")}
      href="/dashboard/intelligence?scope=executive"
    />
  );
}
