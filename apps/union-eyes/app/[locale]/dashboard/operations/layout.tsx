import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { SovereigntyPostureBanner } from "@/components/sovereignty/sovereignty-posture-banner";

export default async function OperationsLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("officer"))) redirect("/dashboard");
  return (
    <>
      <SovereigntyPostureBanner
        surface="Operations"
        minRole="officer"
        posture="Operational cadence and dispatch; sequence work as the reviewer of record for institutional execution."
      />
      {children}
    </>
  );
}
