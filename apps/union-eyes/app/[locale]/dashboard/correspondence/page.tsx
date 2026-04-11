export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { CorrespondenceDashboard } from "./correspondence-dashboard";

export const metadata: Metadata = {
  title: "Correspondence | UnionEyes",
  description: "Draft, review, sign, and dispatch official correspondence",
};

export default async function CorrespondencePage() {
  const user = await requireUser();
  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) redirect("/dashboard");

  const canSign = await hasMinRole("officer");
  const organizationId = user.organizationId || "default";

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Correspondence</h1>
        <p className="text-muted-foreground mt-2">
          Draft, review, sign, and dispatch official letters and communications
        </p>
      </div>

      <CorrespondenceDashboard
        organizationId={organizationId}
        userId={user.userId}
        userRole={user.roles?.[0] ?? "member"}
        canSign={canSign}
      />
    </div>
  );
}
