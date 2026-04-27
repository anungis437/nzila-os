"use client";

/**
 * /dashboard/claims — DEPRECATED: soft-redirects to Inbox with intake filter.
 * Canonical location: /dashboard/inbox?type=intake
 */
import { LegacyRedirect } from "@/components/legacy-redirect";
import { useTranslations } from "next-intl";

export default function ClaimsPage() {
  const t = useTranslations("legacyRoutes");
  return (
    <LegacyRedirect
      oldName={t("claims.oldName")}
      newName={t("claims.newName")}
      href="/dashboard/inbox?type=intake"
    />
  );
}