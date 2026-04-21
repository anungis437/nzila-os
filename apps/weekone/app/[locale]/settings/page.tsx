import { AppLayout } from "@/components/layout/app-layout";
import { SectionHeader } from "@/components/ui/section-header";
import { getDb } from "@/lib/db";
import { CheckCircle, Circle } from "lucide-react";

interface OrgProfile {
  name: string;
  type: string;
  revenueStage: string | null;
  teamSize: number | null;
}

interface Integration {
  id: number;
  provider: string;
  status: string;
  connectedAt: string | null;
}

interface Subscription {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
}

async function getSettingsData() {
  const db = await getDb();
  if (!db) return { org: null, integrations: [], subscription: null };
  try {
    const { sql } = await import("drizzle-orm");
    const [orgRow, intRow, subRow] = await Promise.allSettled([
      db.execute(
        sql`SELECT name, type, revenue_stage, team_size FROM weekone_organizations LIMIT 1`
      ),
      db.execute(
        sql`SELECT id, provider, status, connected_at FROM weekone_integrations`
      ),
      db.execute(
        sql`SELECT plan, status, current_period_end FROM weekone_subscriptions ORDER BY created_at DESC LIMIT 1`
      ),
    ]);
    return {
      org:
        orgRow.status === "fulfilled"
          ? ((orgRow.value as unknown as { rows: OrgProfile[] }).rows?.[0] ??
            null)
          : null,
      integrations:
        intRow.status === "fulfilled"
          ? ((intRow.value as unknown as { rows: Integration[] }).rows ?? [])
          : [],
      subscription:
        subRow.status === "fulfilled"
          ? ((subRow.value as unknown as { rows: Subscription[] }).rows?.[0] ??
            null)
          : null,
    };
  } catch {
    return { org: null, integrations: [], subscription: null };
  }
}

const allProviders = [
  { key: "stripe", label: "Stripe", description: "Payments & revenue" },
  {
    key: "quickbooks",
    label: "QuickBooks",
    description: "Accounting & expenses",
  },
  { key: "hubspot", label: "HubSpot", description: "CRM & pipeline" },
  { key: "pipedrive", label: "Pipedrive", description: "Sales pipeline" },
];

const planLabels: Record<string, string> = {
  solo: "Solo",
  team: "Team",
  growth: "Growth",
};

export default async function SettingsPage() {
  const { org, integrations, subscription } = await getSettingsData();

  const connectedProviders = new Set(
    integrations
      .filter((i) => i.status === "connected")
      .map((i) => i.provider)
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>

        {/* Company Profile */}
        <section>
          <SectionHeader
            title="Company Profile"
            action={
              <button className="text-xs text-electric hover:underline">
                Edit
              </button>
            }
            className="mb-4"
          />
          <div className="rounded-xl border border-border bg-card p-5">
            {org ? (
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Company</dt>
                  <dd className="mt-1 text-sm font-medium">{org.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Type</dt>
                  <dd className="mt-1 text-sm font-medium capitalize">
                    {org.type}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Revenue Stage
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {org.revenueStage ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Team Size</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {org.teamSize ?? "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No company profile yet. Complete onboarding to set up your
                profile.
              </p>
            )}
          </div>
        </section>

        {/* Integrations */}
        <section>
          <SectionHeader
            title="Integrations"
            subtitle="Connect your tools to auto-sync data"
            className="mb-4"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {allProviders.map((p) => {
              const isConnected = connectedProviders.has(p.key);
              return (
                <div
                  key={p.key}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
                >
                  <div>
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          Connected
                        </span>
                      </>
                    ) : (
                      <>
                        <Circle className="h-4 w-4 text-muted-foreground" />
                        <button className="text-xs text-electric hover:underline">
                          Connect
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Plan & Billing */}
        <section>
          <SectionHeader title="Plan & Billing" className="mb-4" />
          <div className="rounded-xl border border-border bg-card p-5">
            {subscription ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Current Plan:{" "}
                    <strong>
                      {planLabels[subscription.plan] ?? subscription.plan}
                    </strong>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                    Status: {subscription.status}
                    {subscription.currentPeriodEnd
                      ? ` · Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <button className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  Manage Billing
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active subscription. Billing details will appear here.
              </p>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
