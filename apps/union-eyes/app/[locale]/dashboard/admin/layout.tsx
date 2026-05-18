/**
 * Dashboard Admin layout — server-side auth guard for all /dashboard/admin/* pages.
 * Requires authenticated user with at least 'admin' role (level 140).
 *
 * NOTE: Admin sub-routes (e.g. /dues) that need to be accessible to
 * lower roles (secretary_treasurer / officer) must define their own
 * path-specific access check in their own layout.tsx. Due to Next.js
 * layout inheritance order (parent runs first), this guard cannot be
 * bypassed by child layouts — sub-routes requiring lower access should
 * be moved outside the /admin route segment.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function DashboardAdminLayout({ children }: { children: ReactNode }) {
  await requireUser();

  const hasAccess = await hasMinRole("admin");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
