/**
 * Dashboard Documents layout — authentication gate for all /dashboard/documents/* pages.
 *
 * Authorization is enforced at the API and service layer per operation:
 *   - Reading document categories: member+  (readRole: 'member')
 *   - Writing document categories: steward+ (writeRole: 'steward')
 *   - Sensitive document operations: officer+ (per API route)
 *
 * The sidebar exposes Documents to both member and staff experiences,
 * so the layout must permit any authenticated user.  Fine-grained access
 * is applied by the individual API routes, not this layout guard.
 */
import { ReactNode } from "react";
import { requireUser } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function DashboardDocumentsLayout({ children }: { children: ReactNode }) {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  return <>{children}</>;
}
