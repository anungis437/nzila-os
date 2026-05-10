import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { SovereigntyPostureBanner } from "@/components/sovereignty/sovereignty-posture-banner";

export default async function LongitudinalCognitionLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("system_admin"))) redirect("/dashboard");
  return (
    <>
      <SovereigntyPostureBanner
        surface="Longitudinal cognition"
        minRole="system_admin"
        posture="Cross-time institutional reasoning; review continuity-relevant patterns before any escalation."
      />
      {children}
    </>
  );
}
