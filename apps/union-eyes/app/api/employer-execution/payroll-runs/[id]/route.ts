import { withApi, ApiError } from "@/lib/api/framework";
import { db } from "@/db";
import { employerPayrollRuns, employerPayrollRunItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const GET = withApi(
  {
    auth: { minRole: "member" },
    entitlement: "employer_payroll_preview",
    openapi: { tags: ["Employer Execution"], summary: "Get payroll run detail" },
  },
  async ({ organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const id = params?.id;
    if (typeof id !== "string") throw ApiError.badRequest("Payroll run id is required");

    const [run] = await db
      .select()
      .from(employerPayrollRuns)
      .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, id)))
      .limit(1);

    if (!run) throw ApiError.notFound("Payroll run not found");

    const items = await db
      .select()
      .from(employerPayrollRunItems)
      .where(and(eq(employerPayrollRunItems.organizationId, organizationId), eq(employerPayrollRunItems.payrollRunId, id)));

    return { data: { run, items } };
  },
);
