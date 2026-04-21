import { AppLayout } from "@/components/layout/app-layout";
import { SectionHeader } from "@/components/ui/section-header";
import { getDb } from "@/lib/db";
import { calculateRunway } from "@/domain/runway";
import { rankPriorities } from "@/domain/priorities";

async function getFocusData() {
  const db = await getDb();
  if (!db) return { snapshot: null, openDeals: 0, pipelineValue: 0 };
  try {
    const { sql } = await import("drizzle-orm");
    const [snapRow, dealsRow] = await Promise.allSettled([
      db.execute(
        sql`SELECT cash_on_hand, monthly_burn, overdue_invoices FROM weekone_cash_snapshots ORDER BY recorded_at DESC LIMIT 1`
      ),
      db.execute(
        sql`SELECT COUNT(*) as count, COALESCE(SUM(value * probability / 100), 0) as weighted, name, value FROM weekone_deals WHERE stage != 'closed' ORDER BY value DESC LIMIT 1`
      ),
    ]);
    const snapshot =
      snapRow.status === "fulfilled"
        ? ((
            snapRow.value as unknown as {
              rows: {
                cashOnHand: number;
                monthlyBurn: number;
                overdueInvoices: number;
              }[];
            }
          ).rows?.[0] ?? null)
        : null;
    const dealsData =
      dealsRow.status === "fulfilled"
        ? (
            dealsRow.value as unknown as {
              rows: {
                count: number;
                weighted: number;
                name: string;
                value: number;
              }[];
            }
          ).rows?.[0]
        : null;
    return {
      snapshot,
      openDeals: Number(dealsData?.count ?? 0),
      pipelineValue: Number(dealsData?.weighted ?? 0),
      topDeal:
        dealsData?.name
          ? { name: dealsData.name, value: dealsData.value }
          : undefined,
    };
  } catch {
    return {
      snapshot: null,
      openDeals: 0,
      pipelineValue: 0,
      topDeal: undefined,
    };
  }
}

const categoryConfig: Record<
  string,
  { bg: string; border: string; label: string }
> = {
  revenue: {
    bg: "bg-electric/10",
    border: "border-electric/30",
    label: "Revenue",
  },
  risk: { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800", label: "Risk" },
  delegation: {
    bg: "bg-violet-50 dark:bg-violet-900/20",
    border: "border-violet-200 dark:border-violet-800",
    label: "Delegation",
  },
  stop: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    label: "Stop",
  },
};

export default async function FocusPage() {
  const { snapshot, openDeals, pipelineValue, topDeal } =
    await getFocusData();

  const runwayDays = snapshot
    ? calculateRunway({
        cashOnHand: snapshot.cashOnHand,
        monthlyBurn: snapshot.monthlyBurn,
      })
    : 180;

  const priorities = rankPriorities({
    runwayDays,
    pipelineValue,
    overdueInvoices: snapshot?.overdueInvoices ?? 0,
    topDeal,
  });

  const stopPriority = priorities.find((p) => p.category === "stop");

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Focus</h1>
          <p className="mt-1 text-muted-foreground">Your weekly priorities</p>
        </div>

        {/* 4-Priority Weekly Focus */}
        <section>
          <SectionHeader
            title="This Week"
            subtitle={`${openDeals} open deal(s) in pipeline`}
            className="mb-4"
          />
          <div className="space-y-3">
            {priorities
              .filter((p) => p.category !== "stop")
              .map((p) => {
                const config =
                  categoryConfig[p.category] ?? categoryConfig["revenue"]!;
                return (
                  <div
                    key={p.rank}
                    className={`rounded-xl border p-5 ${config.bg} ${config.border}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 dark:bg-black/20 text-sm font-bold">
                        {p.rank}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{p.title}</p>
                          <span className="rounded-full bg-white/60 dark:bg-black/20 px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
                            {config.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm opacity-80">
                          {p.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* AI Recommendation */}
        <section className="rounded-xl border border-electric/20 bg-electric/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-electric">
            This week&apos;s recommendation
          </p>
          <p className="mt-2 text-sm font-medium">
            {priorities[0]?.title ?? "Review your priorities"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {priorities[0]?.description ??
              "Add cash and pipeline data to generate personalised recommendations."}
          </p>
        </section>

        {/* What to Ignore */}
        {stopPriority && (
          <section>
            <SectionHeader
              title="What to ignore this week"
              subtitle="Protect your time by stopping these."
              className="mb-3"
            />
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-4">
              <p className="text-sm font-semibold">{stopPriority.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {stopPriority.description}
              </p>
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
