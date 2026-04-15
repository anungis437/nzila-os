import { withApi, ApiError, z } from "@/lib/api/framework";
import { db } from "@/db";
import { employerExecutionComplianceEvents } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const createSchema = z.object({
  payrollRunId: z.string().uuid().optional(),
  remittanceRunId: z.string().uuid().optional(),
  eventCode: z.string(),
  severity: z.enum(["info", "warning", "high", "critical"]).default("warning"),
  summary: z.string(),
  details: z.record(z.unknown()).default({}),
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
  async ({ organizationId, body }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const [event] = await db
      .insert(employerExecutionComplianceEvents)
      .values({
        organizationId,
        payrollRunId: body.payrollRunId,
        remittanceRunId: body.remittanceRunId,
        eventCode: body.eventCode,
        severity: body.severity,
        status: "open",
        summary: body.summary,
        details: body.details,
        blocking: body.blocking,
      })
      .returning();

    return { data: event };
  },
);
