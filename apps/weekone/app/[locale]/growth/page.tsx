import { AppLayout } from "@/components/layout/app-layout";
import { SectionHeader } from "@/components/ui/section-header";
import { getDb } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

interface Deal {
  id: number;
  name: string;
  value: number;
  stage: string;
  probability: number;
  expectedCloseDate: string | null;
  lastActivityAt: string;
}

async function getDeals(): Promise<Deal[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(
      sql`SELECT id, name, value, stage, probability, expected_close_date, last_activity_at FROM weekone_deals ORDER BY value DESC LIMIT 50`
    );
    return (result as unknown as { rows: Deal[] }).rows ?? [];
  } catch {
    return [];
  }
}

const stages = ["discovery", "proposal", "negotiation", "closed"] as const;
type Stage = (typeof stages)[number];

const stageColors: Record<Stage | string, string> = {
  discovery: "bg-blue-50 border-blue-200 dark:bg-blue-900/20",
  proposal: "bg-violet-50 border-violet-200 dark:bg-violet-900/20",
  negotiation: "bg-amber-50 border-amber-200 dark:bg-amber-900/20",
  closed: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20",
};

export default async function GrowthPage() {
  const deals = await getDeals();

  const byStage: Record<string, Deal[]> = {};
  for (const s of stages) byStage[s] = [];
  for (const d of deals) {
    const s = d.stage.toLowerCase();
    if (!byStage[s]) byStage[s] = [];
    byStage[s]!.push(d);
  }

  const openDeals = deals.filter((d) => d.stage !== "closed");
  const weightedValue = openDeals.reduce(
    (sum, d) => sum + d.value * (d.probability / 100),
    0
  );

  const now = new Date();
  const agingProposals = byStage["proposal"]?.filter((d) => {
    const last = new Date(d.lastActivityAt);
    return (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24) > 7;
  }) ?? [];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Growth</h1>
          <p className="mt-1 text-muted-foreground">Pipeline and revenue</p>
        </div>

        {/* Summary Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Open Deals</p>
            <p className="mt-1 text-2xl font-bold">{openDeals.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Weighted Value</p>
            <p className="mt-1 text-2xl font-bold">
              {openDeals.length > 0 ? formatCurrency(weightedValue) : "—"}
            </p>
          </div>
        </div>

        {/* Pipeline Kanban */}
        <section>
          <SectionHeader
            title="Pipeline by Stage"
            action={
              <button className="rounded-md bg-electric px-3 py-1.5 text-xs font-medium text-white hover:bg-electric/90">
                + Add Deal
              </button>
            }
            className="mb-4"
          />
          {deals.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No deals in pipeline yet. Add your first deal to start tracking.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {stages.map((stage) => {
                const stageDeals = byStage[stage] ?? [];
                return (
                  <div key={stage}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold capitalize">
                        {stage}
                      </h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {stageDeals.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {stageDeals.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                          Empty
                        </div>
                      ) : (
                        stageDeals.map((d) => (
                          <div
                            key={d.id}
                            className={`rounded-lg border p-3 ${stageColors[stage] ?? ""}`}
                          >
                            <p className="text-sm font-medium">{d.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatCurrency(d.value)} · {d.probability}%
                            </p>
                            {d.expectedCloseDate && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Close:{" "}
                                {new Date(
                                  d.expectedCloseDate
                                ).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Aging Proposals */}
        {agingProposals.length > 0 && (
          <section>
            <SectionHeader
              title="Aging Proposals"
              subtitle="No activity in 7+ days"
              className="mb-4"
            />
            <div className="space-y-2">
              {agingProposals.map((d) => {
                const daysSince = Math.floor(
                  (now.getTime() - new Date(d.lastActivityAt).getTime()) /
                    (1000 * 60 * 60 * 24)
                );
                return (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-900/20"
                  >
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(d.value)}
                      </p>
                    </div>
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      {daysSince}d ago
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
