/**
 * /dashboard/outcomes — Results, finances, and voting.
 *
 * Reflective surface: "What has been accomplished?"
 * Aggregates voting results, dues status, pension, and financial summaries.
 *
 * Auth: member+ (all union members can review their outcomes).
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/api-auth-guard";
import { OutcomesConsole } from "@/components/outcomes/outcomes-console";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Outcomes | UnionEyes",
};

export default async function OutcomesPage() {
  const user = await requireUser();
  if (!user) redirect("/sign-in");

  return <OutcomesConsole />;
}
