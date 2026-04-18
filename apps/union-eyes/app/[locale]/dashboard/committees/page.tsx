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
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  // Committees are readable for members (API readRole='member' and sidebar link
  // is visible to union members). Keep write actions role-gated inside
  // CommitteesPage via readOnly handling.
  const hasAccess = await hasMinRole("member");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return <CommitteesPage userRole={user.role ?? "member"} />;
}
