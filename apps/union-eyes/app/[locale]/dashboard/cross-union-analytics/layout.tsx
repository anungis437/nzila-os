/**
 * Dashboard Cross-Union Analytics layout — server-side authorisation guard.
 * Restricts /dashboard/cross-union-analytics/* to Federation Staff (160) and above.
 * See docs/union-eyes/runtime-authority-audit/full-feature-gating-hardening.md.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function CrossUnionAnalyticsLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("fed_staff"))) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
