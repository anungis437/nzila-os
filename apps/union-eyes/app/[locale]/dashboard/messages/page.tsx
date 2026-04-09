"use client";

/**
 * /dashboard/messages — DEPRECATED: soft-redirects to Inbox with message filter.
 * Canonical location: /dashboard/inbox?type=message
 */
import { LegacyRedirect } from "@/components/legacy-redirect";

export default function MessagesDashboardPage() {
  return (
    <LegacyRedirect
      oldName="Messages"
      newName="Inbox"
      href="/dashboard/inbox?type=message"
    />
  );
}
