import { requireOrganizationScope } from "@/lib/page-data/organization-scope";
import { getTranslations } from "next-intl/server";
import { listExecutionProfiles } from "@/lib/employer-execution/page-reads";

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

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function EmployerExecutionSettingsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "employerExecutionSettingsPage" });
  const { organizationId } = await requireOrganizationScope();

  const profiles = await listExecutionProfiles(organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section className="rounded-md border p-4">
        <h2 className="text-base font-semibold">{t("runtimeProfilesTitle")}</h2>
        <div className="mt-3 space-y-2 text-sm">
          {profiles.length === 0 ? <p className="text-muted-foreground">{t("noProfileConfigured")}</p> : null}
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
        <h2 className="text-base font-semibold">{t("requiredFeatureKeysTitle")}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-muted-foreground">
          {featureKeys.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
