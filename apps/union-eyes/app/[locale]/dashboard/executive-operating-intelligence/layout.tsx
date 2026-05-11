/**
 * Dashboard Executive Operating Intelligence layout — server-side authorisation guard.
 * Restricts /dashboard/executive-operating-intelligence/* to President (130) and above.
 * See docs/union-eyes/runtime-authority-audit/full-feature-gating-hardening.md.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function ExecutiveOperatingIntelligenceLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("president"))) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
