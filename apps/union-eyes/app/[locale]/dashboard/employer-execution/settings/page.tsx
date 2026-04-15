import { requireUser } from "@/lib/api-auth-guard";
import { db } from "@/db";
import { employerExecutionProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const featureKeys = [
  "employer_execution",
  "employer_timesheet_ingest",
  "employer_payroll_preview",
  "employer_payroll_official",
  "employer_remittance_generation",
  "employer_execution_replay",
  "employer_execution_compliance",
];

export default async function EmployerExecutionSettingsPage() {
  const context = await requireUser();
  const organizationId = context.organizationId;

  const profiles = await db
    .select()
    .from(employerExecutionProfiles)
    .where(eq(employerExecutionProfiles.organizationId, organizationId))
    .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Employer Execution Settings</h1>
        <p className="text-sm text-muted-foreground">Runtime profile and entitlement posture for contractor execution mode.</p>
      </div>

      <section className="rounded-md border p-4">
        <h2 className="text-base font-semibold">Runtime Profiles</h2>
        <div className="mt-3 space-y-2 text-sm">
          {profiles.length === 0 ? <p className="text-muted-foreground">No profile configured.</p> : null}
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded-md border p-3">
              <p className="font-medium">{profile.profileCode}</p>
              <p className="text-muted-foreground">
                {profile.status} | {profile.jurisdiction} | {profile.currency}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border p-4">
        <h2 className="text-base font-semibold">Required Feature Keys</h2>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-muted-foreground">
          {featureKeys.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
