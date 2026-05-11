/**
 * Dashboard Strike Fund layout — server-side authorisation guard.
 * Restricts /dashboard/strike-fund/* to Secretary-Treasurer (110) and above.
 * See docs/union-eyes/runtime-authority-audit/full-feature-gating-hardening.md.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function StrikeFundLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("secretary_treasurer"))) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
