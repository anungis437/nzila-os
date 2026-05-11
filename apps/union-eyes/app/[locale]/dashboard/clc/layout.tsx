/**
 * Dashboard CLC layout — server-side authorisation guard.
 * Restricts /dashboard/clc/* to CLC Staff (180) and above.
 * See docs/union-eyes/runtime-authority-audit/full-feature-gating-hardening.md.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function ClcLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("clc_staff"))) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
