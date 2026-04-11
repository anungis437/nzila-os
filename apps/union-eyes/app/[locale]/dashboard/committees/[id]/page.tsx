export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { CommitteeWorkspace } from "./committee-workspace";

export const metadata: Metadata = {
  title: "Committee Workspace | UnionEyes",
  description: "Committee meetings, minutes, action items, and intelligence",
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  const { id } = await params;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <CommitteeWorkspace
        committeeId={id}
        organizationId={user.organizationId || "default"}
        userId={user.userId}
        userRole={user.role ?? "member"}
      />
    </div>
  );
}
