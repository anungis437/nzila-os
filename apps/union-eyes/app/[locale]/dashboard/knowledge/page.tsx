/**
 * /dashboard/knowledge — Reference, learning, and agreements.
 *
 * Search-first reference hub: agreements, education, clause library,
 * precedents, and calendar.
 *
 * Auth: member+ (all union members can access knowledge).
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/api-auth-guard";
import { KnowledgeConsole } from "@/components/knowledge/knowledge-console";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Knowledge | UnionEyes",
};

export default async function KnowledgePage() {
  const user = await requireUser();
  if (!user) redirect("/sign-in");

  return <KnowledgeConsole />;
}
