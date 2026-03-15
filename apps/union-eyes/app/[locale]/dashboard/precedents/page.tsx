import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { PrecedentsConsole } from "@/components/precedents/precedents-console";

export const dynamic = 'force-dynamic';

export default async function PrecedentsPage() {
  await requireUser();
  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return <PrecedentsConsole />;
}
