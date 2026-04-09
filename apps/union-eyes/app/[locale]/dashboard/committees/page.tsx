export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { CommitteesPage } from "./committees-page";

export const metadata: Metadata = {
  title: "Committees | UnionEyes",
  description: "Manage union committees and their memberships",
};

export default async function Page() {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return <CommitteesPage />;
}
