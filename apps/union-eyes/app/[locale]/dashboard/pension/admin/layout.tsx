/**
 * Dashboard Pension Admin layout — server-side authorisation guard.
 * Restricts /dashboard/pension/admin/* to Admin (140) and above.
 * See docs/union-eyes/runtime-authority-audit/full-feature-gating-hardening.md.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function PensionAdminLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("admin"))) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
