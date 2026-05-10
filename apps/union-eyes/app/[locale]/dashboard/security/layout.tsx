import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { SovereigntyPostureBanner } from "@/components/sovereignty/sovereignty-posture-banner";

export default async function SecurityLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("admin"))) redirect("/dashboard");
  return (
    <>
      <SovereigntyPostureBanner
        surface="Security"
        minRole="admin"
        posture="Continuity-critical configuration; changes are part of the institutional audit trail."
      />
      {children}
    </>
  );
}
