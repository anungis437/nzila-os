/**
 * Dashboard Billing-Admin layout — server-side authorisation guard.
 * Restricts /dashboard/billing-admin/* to Secretary-Treasurer (110) and above.
 * See docs/union-eyes/runtime-authority-audit/full-feature-gating-hardening.md.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function BillingAdminLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("secretary_treasurer"))) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
