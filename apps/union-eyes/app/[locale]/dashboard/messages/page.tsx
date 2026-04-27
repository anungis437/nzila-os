"use client";

/**
 * /dashboard/messages — DEPRECATED: soft-redirects to Inbox with message filter.
 * Canonical location: /dashboard/inbox?type=message
 */
import { LegacyRedirect } from "@/components/legacy-redirect";
import { useTranslations } from "next-intl";

export default function MessagesDashboardPage() {
  const t = useTranslations("legacyRoutes");
  return (
    <LegacyRedirect
      oldName={t("messages.oldName")}
      newName={t("messages.newName")}
      href="/dashboard/inbox?type=message"
    />
  );
}
