"use client";

/**
 * /dashboard/deadlines — DEPRECATED: soft-redirects to Priorities.
 * Canonical location: /dashboard/priorities
 */
import { LegacyRedirect } from "@/components/legacy-redirect";
import { useTranslations } from "next-intl";

export default function DeadlinesPage() {
  const t = useTranslations("legacyRoutes");
  return (
    <LegacyRedirect
      oldName={t("deadlines.oldName")}
      newName={t("deadlines.newName")}
      href="/dashboard/priorities"
    />
  );
}
