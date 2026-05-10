/**
 * Dashboard Compliance-Admin layout — server-side authorisation guard.
 * Restricts /dashboard/compliance-admin/* to Admin (140) and above.
 * See docs/union-eyes/runtime-authority-audit/full-feature-gating-hardening.md.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function ComplianceAdminLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("admin"))) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
