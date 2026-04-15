import { requireUser } from "@/lib/api-auth-guard";
import { db } from "@/db";
import { employerPayrollRuns, employerPayrollRunItems, employerExecutionReplays } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { PayrollRunTracePanel, ReplayDiffViewer } from "@/components/employer-execution";

export const dynamic = "force-dynamic";

export default async function EmployerExecutionPayrollRunDetailPage({ params }: { params: { id: string } }) {
  const context = await requireUser();
  const organizationId = context.organizationId;

  const [run] = await db
    .select()
    .from(employerPayrollRuns)
    .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, params.id)))
    .limit(1);

  if (!run) {
    return <div className="p-6 text-sm text-muted-foreground">Payroll run not found.</div>;
  }

  const items = await db
    .select()
    .from(employerPayrollRunItems)
    .where(and(eq(employerPayrollRunItems.organizationId, organizationId), eq(employerPayrollRunItems.payrollRunId, run.id)));

  const [latestReplay] = await db
    .select()
    .from(employerExecutionReplays)
    .where(
      and(
        eq(employerExecutionReplays.organizationId, organizationId),
        eq(employerExecutionReplays.sourcePayrollRunId, run.id),
      ),
    )
    .orderBy(desc(employerExecutionReplays.createdAt))
    .limit(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payroll Run {run.runCode}</h1>
        <p className="text-sm text-muted-foreground">Status: {run.status}</p>
      </div>

      <PayrollRunTracePanel trace={run.calcTrace as Record<string, unknown>} />

      <ReplayDiffViewer diff={(latestReplay?.diffJson as { changed: boolean; summary: string; fieldsChanged: Array<{ field: string; before: unknown; after: unknown }>; }) ?? null} />

      <div className="rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Gross</th>
              <th className="px-3 py-2">Net</th>
              <th className="px-3 py-2">Dues</th>
              <th className="px-3 py-2">Benefits</th>
              <th className="px-3 py-2">Pension</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">{item.employeeExternalId}</td>
                <td className="px-3 py-2">{item.grossPay}</td>
                <td className="px-3 py-2">{item.netPay}</td>
                <td className="px-3 py-2">{item.duesAmount}</td>
                <td className="px-3 py-2">{item.benefitAmount}</td>
                <td className="px-3 py-2">{item.pensionAmount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
