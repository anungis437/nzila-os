import Link from "next/link";
import { requireUser } from "@/lib/api-auth-guard";
import { db } from "@/db";
import { employerPayrollRuns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { PayrollRunWizard } from "@/components/employer-execution";

export const dynamic = "force-dynamic";

export default async function EmployerExecutionPayrollRunsPage() {
  const context = await requireUser();
  const organizationId = context.organizationId;

  const runs = await db
    .select()
    .from(employerPayrollRuns)
    .where(eq(employerPayrollRuns.organizationId, organizationId))
    .orderBy(desc(employerPayrollRuns.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payroll Runs</h1>
        <p className="text-sm text-muted-foreground">Generate preview or official runs with immutable traces.</p>
      </div>
      <PayrollRunWizard />
      <div className="rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Run</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Total Gross</th>
              <th className="px-3 py-2">Trace</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-t">
                <td className="px-3 py-2">{run.runCode}</td>
                <td className="px-3 py-2">{run.runType}</td>
                <td className="px-3 py-2">{run.status}</td>
                <td className="px-3 py-2">{run.totalGross}</td>
                <td className="px-3 py-2">
                  <Link className="text-blue-700 hover:underline" href={`/dashboard/employer-execution/payroll-runs/${run.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
