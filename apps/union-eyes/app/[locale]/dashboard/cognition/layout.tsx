import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";

export default async function CognitionLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("system_admin"))) redirect("/dashboard");
  return <>{children}</>;
}
