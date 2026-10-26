import { withApi, ApiError, z } from "@/lib/api/framework";
import { db } from "@/db";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { employerExecutionComplianceEvents, employerPayrollRuns, employerRemittanceRuns } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

const createSchema = z.object({
  payrollRunId: z.guid().optional(),
  remittanceRunId: z.guid().optional(),
  eventCode: z.string(),
  severity: z.enum(["info", "warning", "error", "critical"]).default("warning"),
  summary: z.string(),
  details: z.record(z.string(), z.unknown()).default({}),
  blocking: z.enum(["yes", "no"]).default("no"),
});

export const GET = withApi(
  {
    auth: { minRole: "member" },
    entitlement: "employer_execution_compliance",
    openapi: { tags: ["Employer Execution"], summary: "List compliance events" },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const rows = await db
      .select()
      .from(employerExecutionComplianceEvents)
      .where(eq(employerExecutionComplianceEvents.organizationId, organizationId))
      .orderBy(desc(employerExecutionComplianceEvents.detectedAt));
    return { data: rows };
  },
);

export const POST = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "employer_execution_compliance",
    body: createSchema,
    successStatus: 201,
    openapi: { tags: ["Employer Execution"], summary: "Persist compliance event" },
  },
  async ({ organizationId, userId, body }) => {
    if (!organizationId || !userId) throw ApiError.badRequest("Organization context required");

    return withRLSContext({ organizationId }, async (tx) => {
      // A flag may only point at a run of this organization; anything else does not exist for the caller.
      if (body.payrollRunId) {
        const [run] = await tx
          .select({ id: employerPayrollRuns.id })
          .from(employerPayrollRuns)
          .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, body.payrollRunId)))
          .limit(1);
        if (!run) throw ApiError.notFound("Payroll run not found");
      }
      if (body.remittanceRunId) {
        const [run] = await tx
          .select({ id: employerRemittanceRuns.id })
          .from(employerRemittanceRuns)
          .where(
            and(
              eq(employerRemittanceRuns.organizationId, organizationId),
              eq(employerRemittanceRuns.id, body.remittanceRunId),
            ),
          )
          .limit(1);
        if (!run) throw ApiError.notFound("Remittance run not found");
      }

      const [event] = await tx
        .insert(employerExecutionComplianceEvents)
        .values({
          organizationId,
          payrollRunId: body.payrollRunId,
          remittanceRunId: body.remittanceRunId,
          eventCode: body.eventCode,
          severity: body.severity,
          status: "open",
          summary: body.summary,
          details: { ...body.details, raisedBy: userId },
          blocking: body.blocking,
        })
        .returning();

      if (!event) throw ApiError.internal("Failed to persist compliance event");

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: "employer_execution.compliance_event.create",
        resourceType: "employer_execution_compliance_events",
        resourceId: event.id,
        details: {
          eventCode: body.eventCode,
          severity: body.severity,
          blocking: body.blocking,
          payrollRunId: body.payrollRunId ?? null,
          remittanceRunId: body.remittanceRunId ?? null,
        },
      });

      return { data: event };
    });
  },
);
