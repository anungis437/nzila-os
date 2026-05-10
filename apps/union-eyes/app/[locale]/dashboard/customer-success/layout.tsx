import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { SovereigntyPostureBanner } from "@/components/sovereignty/sovereignty-posture-banner";

export default async function CustomerSuccessLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("admin"))) redirect("/dashboard");
  return (
    <>
      <SovereigntyPostureBanner
        surface="Customer success"
        minRole="admin"
        posture="Institutional account stewardship; act on behalf of partner unions with reviewer-of-record discipline."
      />
      {children}
    </>
  );
}
