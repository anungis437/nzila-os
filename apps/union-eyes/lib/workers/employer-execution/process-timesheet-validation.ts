import { db } from "@/db";
import { employerTimesheetBatches, employerTimesheetEntries } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function processTimesheetValidation(batchId: string, organizationId: string) {
  const entries = await db
    .select()
    .from(employerTimesheetEntries)
    .where(and(eq(employerTimesheetEntries.organizationId, organizationId), eq(employerTimesheetEntries.batchId, batchId)));

  const invalid = entries.filter((entry) => entry.validationErrors.length > 0).length;
  const valid = entries.length - invalid;

  await db
    .update(employerTimesheetBatches)
    .set({
      status: invalid > 0 ? "rejected" : "validated",
      validationSummary: { rows: entries.length, valid, invalid, duplicates: 0 },
      updatedAt: new Date(),
    })
    .where(and(eq(employerTimesheetBatches.organizationId, organizationId), eq(employerTimesheetBatches.id, batchId)));

  return { valid, invalid };
}
