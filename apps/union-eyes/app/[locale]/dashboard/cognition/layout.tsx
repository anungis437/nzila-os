import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { SovereigntyPostureBanner } from "@/components/sovereignty/sovereignty-posture-banner";

export default async function CognitionLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("system_admin"))) redirect("/dashboard");
  return (
    <>
      <SovereigntyPostureBanner
        surface="Cognition"
        minRole="system_admin"
        posture="Bounded reasoning over institutional memory; outputs are recommendations for the reviewer of record, not autonomous decisions."
      />
      {children}
    </>
  );
}
