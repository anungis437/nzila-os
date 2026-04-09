"use client";

/**
 * /dashboard/deadlines — DEPRECATED: soft-redirects to Priorities.
 * Canonical location: /dashboard/priorities
 */
import { LegacyRedirect } from "@/components/legacy-redirect";

export default function DeadlinesPage() {
  return (
    <LegacyRedirect
      oldName="Deadlines"
      newName="Priorities"
      href="/dashboard/priorities"
    />
  );
}
