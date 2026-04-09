"use client";

/**
 * /dashboard/insights — DEPRECATED: soft-redirects to Intelligence (federation tab).
 * Canonical location: /dashboard/intelligence?scope=federation
 */
import { LegacyRedirect } from "@/components/legacy-redirect";

export default function InsightsPage() {
  return (
    <LegacyRedirect
      oldName="Insights"
      newName="Intelligence"
      href="/dashboard/intelligence?scope=federation"
    />
  );
}
