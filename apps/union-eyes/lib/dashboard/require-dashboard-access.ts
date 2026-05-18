/**
 * Server-side dashboard access helper.
 *
 * Wraps the common pattern of:
 *   - requiring an authenticated user
 *   - checking a minimum role in the ROLE_HIERARCHY
 *   - redirecting to /dashboard on failure
 *
 * Use this in dashboard sub-layout files to enforce server-side authorization
 * for sections containing sensitive data (governance, audits, reports, etc.).
 *
 * This is complementary to — not a replacement for — the client-side
 * RoleExperienceGuard, which provides UX-level path containment only.
 * Server-side enforcement here ensures that direct URL navigation to
 * restricted dashboard sections is blocked at the layout level.
 *
 * @example
 * ```tsx
 * // apps/union-eyes/app/[locale]/dashboard/governance/layout.tsx
 * export default async function Layout({ children }: { children: ReactNode }) {
 *   await requireDashboardAccess('officer');
 *   return <>{children}</>;
 * }
 * ```
 */
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/api-auth-guard";

/**
 * Enforce server-side access control for a dashboard section.
 *
 * Verifies authentication and role. Redirects to /dashboard if the
 * authenticated user does not meet the minimum role requirement.
 *
 * @param minRole - Minimum role in ROLE_HIERARCHY required to access this section.
 */
export async function requireDashboardAccess(minRole: UserRole): Promise<void> {
  await requireUser();
  const hasAccess = await hasMinRole(minRole);
  if (!hasAccess) {
    redirect("/dashboard");
  }
}
