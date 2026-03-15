/**
 * Admin Members Management Page (server component wrapper)
 * Enforces platform RBAC before rendering the client console.
 */
export const dynamic = 'force-dynamic';

import { auth } from "@clerk/nextjs/server";
import { hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import MembersConsole from "@/components/admin/members-console";

export default async function AdminMembersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const isAdmin = await hasMinRole("support_manager");
  if (!isAdmin) redirect("/dashboard");

  return <MembersConsole />;
}
