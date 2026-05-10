import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";

export default async function OperationsLayout({ children }: { children: ReactNode }) {
  await requireUser();
  if (!(await hasMinRole("officer"))) redirect("/dashboard");
  return <>{children}</>;
}
