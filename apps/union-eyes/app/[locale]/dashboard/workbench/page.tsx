export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import WorkbenchConsole from "@/components/workbench/workbench-console";

export const metadata: Metadata = {
  title: "LRO Workbench | UnionEyes",
  description: "Case queue for union labour relations officers",
};

export default async function WorkbenchPage() {
  await requireUser();

  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return <WorkbenchConsole />;
}
