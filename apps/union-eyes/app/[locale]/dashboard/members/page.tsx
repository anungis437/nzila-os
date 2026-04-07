export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import MembersConsole from '@/components/members/members-console';

export const metadata: Metadata = {
  title: "Members Directory | UnionEyes",
  description: "View and manage union member contacts and information",
};

export default async function MembersPage() {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return <MembersConsole />;
}
