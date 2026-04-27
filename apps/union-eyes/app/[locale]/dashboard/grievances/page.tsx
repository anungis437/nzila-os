"use client";

/**
 * /dashboard/grievances — DEPRECATED: soft-redirects to Work surface.
 * Canonical location: /dashboard/work
 */
import { LegacyRedirect } from "@/components/legacy-redirect";
import { useTranslations } from "next-intl";

export default function GrievancesPage() {
  const t = useTranslations("legacyRoutes");
  return (
    <LegacyRedirect
      oldName={t("grievances.oldName")}
      newName={t("grievances.newName")}
      href="/dashboard/work"
    />
  );
}
