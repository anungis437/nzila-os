import { requireUser } from "@/lib/api-auth-guard";
import { db } from "@/db";
import { employerRemittanceRuns, employerExecutionArtifacts, employerExecutionComplianceEvents } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
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
    )
    .orderBy(desc(employerExecutionArtifacts.createdAt));

  const complianceEvents = await db
    .select()
    .from(employerExecutionComplianceEvents)
    .where(
      and(
        eq(employerExecutionComplianceEvents.organizationId, organizationId),
        eq(employerExecutionComplianceEvents.remittanceRunId, run.id),
      ),
    )
    .orderBy(desc(employerExecutionComplianceEvents.detectedAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Remittance Run {run.runCode}</h1>
        <p className="text-sm text-muted-foreground">Status: {run.status}</p>
      </div>

      <div className="rounded-md border p-4 text-sm">
        <h2 className="font-medium">Run Summary</h2>
        <p className="mt-1 text-muted-foreground">Payroll Run: {String(run.payrollRunId)}</p>
        <p className="text-muted-foreground">Due Date: {String(run.dueDate)}</p>
        <p className="text-muted-foreground">Total Due: {String(run.totalDue)}</p>
        <p className="text-muted-foreground">Generated At: {String(run.generatedAt ?? "n/a")}</p>
      </div>

      <div className="rounded-md border p-4 text-sm">
        <h2 className="font-medium">Compliance State</h2>
        {complianceEvents.length === 0 ? <p className="mt-1 text-muted-foreground">No compliance events.</p> : null}
        {complianceEvents.map((event) => (
          <p key={event.id} className="mt-1 text-muted-foreground">
            {event.severity} | {event.status} | {event.summary}
          </p>
        ))}
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
