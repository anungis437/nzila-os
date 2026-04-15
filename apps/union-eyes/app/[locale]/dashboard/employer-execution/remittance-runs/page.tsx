import Link from "next/link";
import { requireUser } from "@/lib/api-auth-guard";
import { db } from "@/db";
import { employerRemittanceRuns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { RemittanceRunTable } from "@/components/employer-execution";

export const dynamic = "force-dynamic";

export default async function EmployerExecutionRemittanceRunsPage() {
  const context = await requireUser();
  const organizationId = context.organizationId;

  const runs = await db
    .select()
    .from(employerRemittanceRuns)
    .where(eq(employerRemittanceRuns.organizationId, organizationId))
    .orderBy(desc(employerRemittanceRuns.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Remittance Runs</h1>
        <p className="text-sm text-muted-foreground">Generated package runs with evidence-sealed artifacts.</p>
      </div>
      <RemittanceRunTable
        rows={runs.map((run) => ({
          id: run.id,
          runCode: run.runCode,
          status: run.status,
          dueDate: String(run.dueDate),
          totalDue: String(run.totalDue),
        }))}
      />
      <div className="space-y-2 text-sm">
        {runs.map((run) => (
          <Link key={run.id} className="block text-blue-700 hover:underline" href={`/dashboard/employer-execution/remittance-runs/${run.id}`}>
            Open {run.runCode}
          </Link>
        ))}
      </div>
    </div>
  );
}
