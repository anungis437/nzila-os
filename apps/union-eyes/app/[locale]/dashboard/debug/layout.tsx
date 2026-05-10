/**
 * Dashboard Debug layout — server-side authorisation guard.
 * Restricts /dashboard/debug/* to System Admin (200) and above.
 * See docs/union-eyes/runtime-authority-audit/full-feature-gating-hardening.md.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function DebugLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("system_admin"))) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
