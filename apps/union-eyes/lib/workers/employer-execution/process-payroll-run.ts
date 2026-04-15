import { db } from "@/db";
import { employerPayrollRuns } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function processPayrollRun(payrollRunId: string, organizationId: string) {
  await db
    .update(employerPayrollRuns)
    .set({ status: "calculated", updatedAt: new Date() })
    .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, payrollRunId)));

  return { payrollRunId, status: "calculated" };
}
