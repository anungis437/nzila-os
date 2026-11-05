/**
 * What the employer-execution pages read, one function per page.
 *
 * Each function runs inside the organization's own transaction (withRLSContext), so row-level security applies as it does for the routes
 * and a caller sees only the rows the organization owns. The pages used to read through the module-level handle with no organization
 * set; the runtime role then saw no row of any of these tables. A database failure is thrown to the page, never turned into an empty list.
 */
import { and, desc, eq } from 'drizzle-orm';
import {
  employerExecutionArtifacts,
  employerExecutionComplianceEvents,
  employerExecutionProfiles,
  employerExecutionReplays,
  employerPayrollRunItems,
  employerPayrollRuns,
  employerRemittanceRuns,
  employerTimesheetBatches,
  employerTimesheetEntries,
} from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { isUuid } from '@/lib/page-data/uuid';

type PayrollRun = typeof employerPayrollRuns.$inferSelect;
type PayrollRunItem = typeof employerPayrollRunItems.$inferSelect;
type Replay = typeof employerExecutionReplays.$inferSelect;
type ComplianceEvent = typeof employerExecutionComplianceEvents.$inferSelect;
type Artifact = typeof employerExecutionArtifacts.$inferSelect;
type RemittanceRun = typeof employerRemittanceRuns.$inferSelect;
type Profile = typeof employerExecutionProfiles.$inferSelect;
type TimesheetBatch = typeof employerTimesheetBatches.$inferSelect;
type TimesheetEntry = typeof employerTimesheetEntries.$inferSelect;

export function listComplianceEvents(organizationId: string, limit = 100): Promise<ComplianceEvent[]> {
  return withRLSContext({ organizationId }, (tx) =>
    tx
      .select()
      .from(employerExecutionComplianceEvents)
      .where(eq(employerExecutionComplianceEvents.organizationId, organizationId))
      .orderBy(desc(employerExecutionComplianceEvents.detectedAt))
      .limit(limit),
  );
}

export function listPayrollRuns(organizationId: string, limit = 50): Promise<PayrollRun[]> {
  return withRLSContext({ organizationId }, (tx) =>
    tx
      .select()
      .from(employerPayrollRuns)
      .where(eq(employerPayrollRuns.organizationId, organizationId))
      .orderBy(desc(employerPayrollRuns.createdAt))
      .limit(limit),
  );
}

export interface PayrollRunDetail {
  run: PayrollRun;
  items: PayrollRunItem[];
  latestReplay: Replay | null;
  complianceEvents: ComplianceEvent[];
  artifacts: Artifact[];
}

/** One payroll run of the organization with its items, newest replay, compliance events and evidence; null when it is not the organization's. */
export async function loadPayrollRunDetail(organizationId: string, runId: string): Promise<PayrollRunDetail | null> {
  if (!isUuid(runId)) return null;
  return withRLSContext({ organizationId }, async (tx) => {
    const [run] = await tx
      .select()
      .from(employerPayrollRuns)
      .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, runId)))
      .limit(1);
    if (!run) return null;

    const items = await tx
      .select()
      .from(employerPayrollRunItems)
      .where(and(eq(employerPayrollRunItems.organizationId, organizationId), eq(employerPayrollRunItems.payrollRunId, run.id)));
    const [latestReplay] = await tx
      .select()
      .from(employerExecutionReplays)
      .where(and(eq(employerExecutionReplays.organizationId, organizationId), eq(employerExecutionReplays.sourcePayrollRunId, run.id)))
      .orderBy(desc(employerExecutionReplays.createdAt))
      .limit(1);
    const complianceEvents = await tx
      .select()
      .from(employerExecutionComplianceEvents)
      .where(and(eq(employerExecutionComplianceEvents.organizationId, organizationId), eq(employerExecutionComplianceEvents.payrollRunId, run.id)))
      .orderBy(desc(employerExecutionComplianceEvents.detectedAt));
    const artifacts = await tx
      .select()
      .from(employerExecutionArtifacts)
      .where(and(eq(employerExecutionArtifacts.organizationId, organizationId), eq(employerExecutionArtifacts.payrollRunId, run.id)))
      .orderBy(desc(employerExecutionArtifacts.createdAt));
    return { run, items, latestReplay: latestReplay ?? null, complianceEvents, artifacts };
  });
}

export function listRemittanceRuns(organizationId: string, limit = 50): Promise<RemittanceRun[]> {
  return withRLSContext({ organizationId }, (tx) =>
    tx
      .select()
      .from(employerRemittanceRuns)
      .where(eq(employerRemittanceRuns.organizationId, organizationId))
      .orderBy(desc(employerRemittanceRuns.createdAt))
      .limit(limit),
  );
}

export interface RemittanceRunDetail {
  run: RemittanceRun;
  artifacts: Artifact[];
  complianceEvents: ComplianceEvent[];
}

/** One remittance run of the organization with its evidence and compliance events; null when it is not the organization's. */
export async function loadRemittanceRunDetail(organizationId: string, runId: string): Promise<RemittanceRunDetail | null> {
  if (!isUuid(runId)) return null;
  return withRLSContext({ organizationId }, async (tx) => {
    const [run] = await tx
      .select()
      .from(employerRemittanceRuns)
      .where(and(eq(employerRemittanceRuns.organizationId, organizationId), eq(employerRemittanceRuns.id, runId)))
      .limit(1);
    if (!run) return null;

    const artifacts = await tx
      .select()
      .from(employerExecutionArtifacts)
      .where(and(eq(employerExecutionArtifacts.organizationId, organizationId), eq(employerExecutionArtifacts.remittanceRunId, run.id)))
      .orderBy(desc(employerExecutionArtifacts.createdAt));
    const complianceEvents = await tx
      .select()
      .from(employerExecutionComplianceEvents)
      .where(and(eq(employerExecutionComplianceEvents.organizationId, organizationId), eq(employerExecutionComplianceEvents.remittanceRunId, run.id)))
      .orderBy(desc(employerExecutionComplianceEvents.detectedAt));
    return { run, artifacts, complianceEvents };
  });
}

export function listExecutionProfiles(organizationId: string, limit = 20): Promise<Profile[]> {
  return withRLSContext({ organizationId }, (tx) =>
    tx.select().from(employerExecutionProfiles).where(eq(employerExecutionProfiles.organizationId, organizationId)).limit(limit),
  );
}

export interface LatestTimesheetBatch {
  batch: TimesheetBatch | null;
  entries: TimesheetEntry[];
}

/** The organization's newest timesheet batch and up to `entryLimit` of its entries; no batch is a batch of null with no entries. */
export function loadLatestTimesheetBatch(organizationId: string, entryLimit = 100): Promise<LatestTimesheetBatch> {
  return withRLSContext({ organizationId }, async (tx) => {
    const [batch] = await tx
      .select()
      .from(employerTimesheetBatches)
      .where(eq(employerTimesheetBatches.organizationId, organizationId))
      .orderBy(desc(employerTimesheetBatches.createdAt))
      .limit(1);
    if (!batch) return { batch: null, entries: [] };

    const entries = await tx
      .select()
      .from(employerTimesheetEntries)
      .where(and(eq(employerTimesheetEntries.organizationId, organizationId), eq(employerTimesheetEntries.batchId, batch.id)))
      .limit(entryLimit);
    return { batch, entries };
  });
}
