/**
 * POST /api/employer-execution/timesheets/:batchId/mapping (DEF-0B6-EMP-OFFICIAL-APPROVAL-UNREACHABLE,
 * UE-CAP-D-002).
 *
 * Timesheet ingest never writes member_employment_id or job_classification_id on an entry (the
 * uploaded file names an external payroll/HR system's own employee id, not a Union Eyes identity), so
 * every official payroll run opens a critical, blocking missing_employment_mapping compliance event
 * and approveRun refuses while it is open. No route set the mapping or resolved the event - this is
 * that mechanism.
 *
 * Deterministic and auditable, never guessed: the caller submits explicit, one-to-one
 * (employeeExternalId -> memberEmploymentId) pairs; no fuzzy or name-based auto-matching is attempted.
 * An externalId with no submitted mapping is left exactly as it was - unresolved matches are safely
 * held for review rather than silently defaulted. Every mapping is validated to reference a real
 * member_employment (and, if given, job_classification) row of this organization before anything is
 * written; an invalid reference refuses the whole request rather than applying the valid ones and
 * silently dropping the rest.
 *
 * The transactional logic itself lives in lib/employer-execution/resolve-employment-mapping.ts
 * (testable without an HTTP context, mirroring payroll-run-transitions.ts's approveRun/executeRun).
 */
import { withApi, ApiError, z } from "@/lib/api/framework";
import { FINANCIAL_MEMBER_DATA_ROLES } from "@/lib/finance/financial-authority";
import { requireLiveFinancialMandate } from "@/lib/finance/require-live-financial-mandate";
import { employerTimesheetBatches } from "@/db/schema";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { resolveEmploymentMapping } from "@/lib/employer-execution/resolve-employment-mapping";
import { and, eq } from "drizzle-orm";

const mappingSchema = z.object({
  employeeExternalId: z.string().trim().min(1).max(120),
  memberEmploymentId: z.guid(),
  jobClassificationId: z.guid().optional(),
}).strict();

const body = z.object({
  mappings: z.array(mappingSchema).min(1).max(500),
}).strict();

export const POST = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: "employer_timesheet_ingest",
    body,
    openapi: { tags: ["Employer Execution"], summary: "Resolve external payroll identities to member employment records" },
  },
  async ({ organizationId, userId, params, body: input }) => {
    if (!organizationId || !userId) throw ApiError.badRequest("Organization context required");
    const batchId = params.batchId;

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [batch] = await tx
        .select({ employerId: employerTimesheetBatches.employerId })
        .from(employerTimesheetBatches)
        .where(and(eq(employerTimesheetBatches.organizationId, organizationId), eq(employerTimesheetBatches.id, batchId)))
        .limit(1);
      if (!batch) throw ApiError.notFound("Timesheet batch");

      await requireLiveFinancialMandate(tx, { organizationId, userId, action: "finance:prepare", employerId: batch.employerId ?? undefined });

      const result = await resolveEmploymentMapping(tx, { organizationId, userId, batchId, mappings: input.mappings });
      return { data: result };
    });
  },
);
