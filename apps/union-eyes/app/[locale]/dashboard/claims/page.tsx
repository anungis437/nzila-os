"use client";

/**
 * /dashboard/claims — DEPRECATED: soft-redirects to Inbox with intake filter.
 * Canonical location: /dashboard/inbox?type=intake
 */
import { LegacyRedirect } from "@/components/legacy-redirect";

export default function ClaimsPage() {
  return (
    <LegacyRedirect
      oldName="Claims"
      newName="Inbox"
      href="/dashboard/inbox?type=intake"
    />
  );
}