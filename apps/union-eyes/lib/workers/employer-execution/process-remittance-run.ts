import { db } from "@/db";
import { employerRemittanceRuns } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function processRemittanceRun(remittanceRunId: string, organizationId: string) {
  await db
    .update(employerRemittanceRuns)
    .set({ status: "generated", updatedAt: new Date() })
    .where(and(eq(employerRemittanceRuns.organizationId, organizationId), eq(employerRemittanceRuns.id, remittanceRunId)));

  return { remittanceRunId, status: "generated" };
}
