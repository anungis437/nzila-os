/**
 * /dashboard/priorities — "What should I do next?"
 *
 * Surfaces top-priority items: overdue cases, upcoming deadlines,
 * urgency signals, and team-level view for officers.
 *
 * Query params:
 *   ?view=team — shows team-level priorities (officer+)
 *
 * Auth: steward+ (members are redirected to inbox).
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { PrioritiesConsole } from "@/components/priorities/priorities-console";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Priorities | UnionEyes",
};

export default async function PrioritiesPage() {
  const user = await requireUser();
  if (!user) redirect("/sign-in");
  const authorized = await hasMinRole("steward");
  if (!authorized) redirect("/dashboard/inbox");

  return <PrioritiesConsole />;
}
