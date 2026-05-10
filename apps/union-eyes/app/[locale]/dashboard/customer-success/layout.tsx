import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";

export default async function CustomerSuccessLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("admin"))) redirect("/dashboard");
  return <>{children}</>;
}
