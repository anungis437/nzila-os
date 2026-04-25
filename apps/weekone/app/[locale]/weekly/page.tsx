import { AppLayout } from "@/components/layout/app-layout";
import { SectionHeader } from "@/components/ui/section-header";
import { GenerateBriefButton } from "@/components/weekly/generate-brief-button";
import { MondayResetButton } from "@/components/weekly/monday-reset-button";
import { TemplatePresets } from "@/components/weekly/template-presets";
import { getDb } from "@/lib/db";

interface WeeklyBrief {
  id: number;
  weekStartDate: string;
  summary: string;
  priorities: string[];
  moneyWatch: string;
  pipelineWatch: string;
  riskWatch: string;
  founderRecommendation: string;
  generatedAt: string;
}

async function getWeeklyBriefs(): Promise<WeeklyBrief[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(
      sql`SELECT id, week_start_date, summary, priorities, money_watch, pipeline_watch, risk_watch, founder_recommendation, generated_at FROM weekone_weekly_briefs ORDER BY week_start_date DESC LIMIT 10`
    );
    return (result as unknown as { rows: WeeklyBrief[] }).rows ?? [];
  } catch {
    return [];
  }
}

export default async function WeeklyPage() {
  const briefs = await getWeeklyBriefs();
  const latest = briefs[0] ?? null;
  const archive = briefs.slice(1);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Weekly Briefs</h1>
          <p className="mt-1 text-muted-foreground">
            Your baseline closeout archive
          </p>
        </div>

        {/* Generate Button */}
        <div className="flex flex-col gap-4">
          <GenerateBriefButton />
          <MondayResetButton />
          <TemplatePresets />
        </div>

        {briefs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No weekly briefs yet. Generate your first brief to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Latest Brief */}
            {latest && (
              <section>
                <SectionHeader
                  title="Latest Brief"
                  subtitle={`Week of ${new Date(latest.weekStartDate).toLocaleDateString()}`}
                  helpContent="This is your weekly operating closeout: what happened, what changed, and what to run next."
                  className="mb-4"
                />
                <div className="rounded-xl border border-border bg-card p-6 space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Summary
                    </p>
                    <p className="mt-2 text-sm">{latest.summary}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Priorities
                    </p>
                    <ul className="mt-2 space-y-1">
                      {(Array.isArray(latest.priorities)
                        ? latest.priorities
                        : []
                      ).map((p, i) => (
                        <li key={i} className="text-sm">
                          {typeof p === "string" ? p : JSON.stringify(p)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Money Watch
                      </p>
                      <p className="mt-1 text-sm">{latest.moneyWatch}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Pipeline Watch
                      </p>
                      <p className="mt-1 text-sm">{latest.pipelineWatch}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Risk Watch
                      </p>
                      <p className="mt-1 text-sm">{latest.riskWatch}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-electric/20 bg-electric/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-electric">
                      Founder Recommendation
                    </p>
                    <p className="mt-1 text-sm">
                      {latest.founderRecommendation}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Archive */}
            {archive.length > 0 && (
              <section>
                <SectionHeader
                  title="Archive"
                  helpContent="Use archive trends to spot repeated misses and improve your baseline cadence each month."
                  className="mb-4"
                />
                <div className="space-y-2">
                  {archive.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          Week of{" "}
                          {new Date(b.weekStartDate).toLocaleDateString()}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {b.summary}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(b.generatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
