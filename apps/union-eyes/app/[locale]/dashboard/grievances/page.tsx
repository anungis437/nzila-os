"use client";

/**
 * /dashboard/grievances — DEPRECATED: soft-redirects to Work surface.
 * Canonical location: /dashboard/work
 */
import { LegacyRedirect } from "@/components/legacy-redirect";

export default function GrievancesPage() {
  return (
    <LegacyRedirect
      oldName="Grievances"
      newName="Work"
      href="/dashboard/work"
    />
  );
}
