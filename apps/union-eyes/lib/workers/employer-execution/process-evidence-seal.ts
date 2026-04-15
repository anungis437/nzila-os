import { db } from "@/db";
import { employerExecutionArtifacts } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function processEvidenceSeal(remittanceRunId: string, organizationId: string) {
  const artifacts = await db
    .select()
    .from(employerExecutionArtifacts)
    .where(
      and(
        eq(employerExecutionArtifacts.organizationId, organizationId),
        eq(employerExecutionArtifacts.remittanceRunId, remittanceRunId),
      ),
    );

  const seal = artifacts.find((artifact) => artifact.artifactType === "evidence_seal");
  return {
    remittanceRunId,
    sealed: Boolean(seal),
    artifactCount: artifacts.length,
  };
}
