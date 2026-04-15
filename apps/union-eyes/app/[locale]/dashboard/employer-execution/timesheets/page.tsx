import { requireUser } from "@/lib/api-auth-guard";
import { db } from "@/db";
import { employerTimesheetBatches, employerTimesheetEntries } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { TimesheetBatchUploader, TimesheetValidationTable } from "@/components/employer-execution";

export const dynamic = "force-dynamic";

export default async function EmployerExecutionTimesheetsPage() {
  const context = await requireUser();
  const organizationId = context.organizationId;

  const batches = await db
    .select()
    .from(employerTimesheetBatches)
    .where(eq(employerTimesheetBatches.organizationId, organizationId))
    .orderBy(desc(employerTimesheetBatches.createdAt))
    .limit(1);

  const latestBatch = batches[0];
  const entries = latestBatch
    ? await db
        .select()
        .from(employerTimesheetEntries)
        .where(
          and(
            eq(employerTimesheetEntries.organizationId, organizationId),
            eq(employerTimesheetEntries.batchId, latestBatch.id),
          ),
        )
        .limit(100)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Timesheet Ingestion</h1>
        <p className="text-sm text-muted-foreground">Upload CSV, normalize, and review validation outcomes.</p>
      </div>
      <TimesheetBatchUploader />
      <TimesheetValidationTable
        rows={entries.map((entry) => ({
          rowNumber: entry.rowNumber,
          employeeExternalId: entry.employeeExternalId,
          shiftDate: String(entry.shiftDate),
          regularHours: String(entry.regularHours),
          overtimeHours: String(entry.overtimeHours),
          status: entry.status,
          validationErrors: entry.validationErrors,
        }))}
      />
    </div>
  );
}
