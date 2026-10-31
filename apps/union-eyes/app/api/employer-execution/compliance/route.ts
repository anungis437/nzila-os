import { withApi, ApiError, z } from "@/lib/api/framework";
import { db } from "@/db";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { employerExecutionComplianceEvents, employerPayrollRuns, employerRemittanceRuns } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { FINANCIAL_MEMBER_DATA_ROLES } from "@/lib/finance/financial-authority";

// A person flags a run for review; the engine raises error, critical and blocking events itself. A manual flag therefore
// cannot carry those severities, cannot block an approval, and cannot take the code of an engine event.
const createSchema = z.object({
  payrollRunId: z.guid().optional(),
  remittanceRunId: z.guid().optional(),
  eventCode: z.string().trim().regex(/^[a-z0-9_]{1,60}$/, "eventCode is lower-case letters, digits and underscores"),
  severity: z.enum(["info", "warning"]).default("warning"),
  summary: z.string().trim().min(1).max(500),
  details: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const GET = withApi(
  {
    // The events describe payroll and remittance runs, which the financial roles hold; a member reads none of them.
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: "employer_execution_compliance",
    openapi: { tags: ["Employer Execution"], summary: "List compliance events" },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const rows = await db
      .select()
      .from(employerExecutionComplianceEvents)
      .where(eq(employerExecutionComplianceEvents.organizationId, organizationId))
      .orderBy(desc(employerExecutionComplianceEvents.detectedAt))
      .limit(500);
    return { data: rows };
  },
);

export const POST = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
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
          eventCode: body.eventCode.startsWith("manual_") ? body.eventCode : `manual_${body.eventCode}`,
          severity: body.severity,
          status: "open",
          summary: body.summary,
          details: { ...body.details, raisedBy: userId },
          blocking: "no",
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
          eventCode: body.eventCode.startsWith("manual_") ? body.eventCode : `manual_${body.eventCode}`,
          severity: body.severity,
          blocking: "no",
          payrollRunId: body.payrollRunId ?? null,
          remittanceRunId: body.remittanceRunId ?? null,
        },
      });

      return { data: event };
    });
  },
);
