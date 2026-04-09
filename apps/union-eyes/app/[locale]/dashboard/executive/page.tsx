"use client";

/**
 * /dashboard/executive — DEPRECATED: soft-redirects to Intelligence (executive tab).
 * Canonical location: /dashboard/intelligence?scope=executive
 */
import { LegacyRedirect } from "@/components/legacy-redirect";

export default function ExecutiveDashboardPage() {
  return (
    <LegacyRedirect
      oldName="Executive"
      newName="Intelligence"
      href="/dashboard/intelligence?scope=executive"
    />
  );
}
