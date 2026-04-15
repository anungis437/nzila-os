import { requireUser } from "@/lib/api-auth-guard";
import { EmployerExecutionDashboard } from "@/components/employer-execution";

export const dynamic = "force-dynamic";

export default async function EmployerExecutionPage() {
  await requireUser();
  return <EmployerExecutionDashboard />;
}
