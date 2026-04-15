import { requireUser } from "@/lib/api-auth-guard";
import { db } from "@/db";
import { employerRemittanceRuns, employerExecutionArtifacts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { RemittanceArtifactCard } from "@/components/employer-execution";

export const dynamic = "force-dynamic";

export default async function EmployerExecutionRemittanceRunDetailPage({ params }: { params: { id: string } }) {
  const context = await requireUser();
  const organizationId = context.organizationId;

  const [run] = await db
    .select()
    .from(employerRemittanceRuns)
    .where(and(eq(employerRemittanceRuns.organizationId, organizationId), eq(employerRemittanceRuns.id, params.id)))
    .limit(1);

  if (!run) {
    return <div className="p-6 text-sm text-muted-foreground">Remittance run not found.</div>;
  }

  const artifacts = await db
    .select()
    .from(employerExecutionArtifacts)
    .where(
      and(
        eq(employerExecutionArtifacts.organizationId, organizationId),
        eq(employerExecutionArtifacts.remittanceRunId, run.id),
      ),
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Remittance Run {run.runCode}</h1>
        <p className="text-sm text-muted-foreground">Status: {run.status}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {artifacts.map((artifact) => (
          <RemittanceArtifactCard
            key={artifact.id}
            artifact={{
              id: artifact.id,
              artifactType: artifact.artifactType,
              artifactName: artifact.artifactName,
              artifactHash: artifact.artifactHash,
              storageRef: artifact.storageRef,
            }}
          />
        ))}
      </div>
    </div>
  );
}
