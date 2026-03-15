/**
 * Phase 5B: Shared Clause Library Page (server wrapper)
 * Auth-gated — delegates to ClauseLibraryConsole client component
 */

import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { ClauseLibraryConsole } from "@/components/clause-library/clause-library-console";

export const dynamic = "force-dynamic";

export default async function ClauseLibraryPage() {
  await requireUser();
  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }
  return <ClauseLibraryConsole />;
}
