import { withApi, ApiError } from "@/lib/api/framework";
import { db } from "@/db";
import { employerRemittanceRuns, employerRemittanceRunItems, employerExecutionArtifacts } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const GET = withApi(
  {
    auth: { minRole: "member" },
    entitlement: "employer_remittance_generation",
    openapi: { tags: ["Employer Execution"], summary: "Get remittance run detail" },
  },
  async ({ organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const id = params?.id;
    if (typeof id !== "string") throw ApiError.badRequest("Remittance run id is required");

    const [run] = await db
      .select()
      .from(employerRemittanceRuns)
      .where(and(eq(employerRemittanceRuns.organizationId, organizationId), eq(employerRemittanceRuns.id, id)))
      .limit(1);

    if (!run) throw ApiError.notFound("Remittance run not found");

    const items = await db
      .select()
      .from(employerRemittanceRunItems)
      .where(and(eq(employerRemittanceRunItems.organizationId, organizationId), eq(employerRemittanceRunItems.remittanceRunId, id)));

    const artifacts = await db
      .select()
      .from(employerExecutionArtifacts)
      .where(and(eq(employerExecutionArtifacts.organizationId, organizationId), eq(employerExecutionArtifacts.remittanceRunId, id)));

    return { data: { run, items, artifacts } };
  },
);
