import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { SovereigntyPostureBanner } from "@/components/sovereignty/sovereignty-posture-banner";

export default async function OpsLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("system_admin"))) redirect("/dashboard");
  return (
    <>
      <SovereigntyPostureBanner
        surface="Sovereign ops"
        minRole="system_admin"
        posture="Sovereignty-layer runtime controls; every action is logged and continuity-affecting."
      />
      {children}
    </>
  );
}
