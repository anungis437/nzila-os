import { AppLayout } from "@/components/layout/app-layout";
import { RiskBadge } from "@/components/ui/risk-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { getDb } from "@/lib/db";
import { calculateRunway } from "@/domain/runway";
import { scoreRisks, type RiskFactor } from "@/domain/risk";

async function getRiskData() {
  const db = await getDb();
  if (!db) return { snapshot: null, openDeals: 0, lastActivityDays: 0 };
  try {
    const { sql } = await import("drizzle-orm");
    const [snapRow, dealsRow, activityRow] = await Promise.allSettled([
      db.execute(
        sql`SELECT cash_on_hand, monthly_burn, overdue_invoices FROM weekone_cash_snapshots ORDER BY recorded_at DESC LIMIT 1`
      ),
      db.execute(
        sql`SELECT COUNT(*) as count FROM weekone_deals WHERE stage != 'closed'`
      ),
      db.execute(
        sql`SELECT EXTRACT(DAY FROM NOW() - MAX(last_activity_at)) as days FROM weekone_deals`
      ),
    ]);
    return {
      snapshot:
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
          : null,
      openDeals:
        dealsRow.status === "fulfilled"
          ? Number(
              (
                dealsRow.value as unknown as { rows: { count: number }[] }
              ).rows?.[0]?.count ?? 0
            )
          : 0,
      lastActivityDays:
        activityRow.status === "fulfilled"
          ? Number(
              (
                activityRow.value as unknown as { rows: { days: number }[] }
              ).rows?.[0]?.days ?? 0
            )
          : 0,
    };
  } catch {
    return { snapshot: null, openDeals: 0, lastActivityDays: 0 };
  }
}

export default async function RisksPage() {
  const { snapshot, openDeals, lastActivityDays } = await getRiskData();

  const runwayDays = snapshot
    ? calculateRunway({
        cashOnHand: snapshot.cashOnHand,
        monthlyBurn: snapshot.monthlyBurn,
      })
    : Infinity;

  const risks: RiskFactor[] = scoreRisks({
    runwayDays,
    overdueInvoicesCount: snapshot?.overdueInvoices ?? 0,
    openDealsCount: openDeals,
    prioritiesCount: 4,
    lastActivityDays,
  });

  const criticalRisks = risks.filter((r) => r.level === "critical");
  const highRisks = risks.filter((r) => r.level === "high");
  const mediumRisks = risks.filter((r) => r.level === "medium");
  const lowRisks = risks.filter((r) => r.level === "low");

  const grouped: { label: string; items: RiskFactor[] }[] = [
    { label: "Critical", items: criticalRisks },
    { label: "High", items: highRisks },
    { label: "Medium", items: mediumRisks },
    { label: "Low", items: lowRisks },
  ].filter((g) => g.items.length > 0);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Risk Radar</h1>
            <p className="mt-1 text-muted-foreground">
              Active risks requiring attention
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Risk Count Summary */}
        <div className="grid grid-cols-4 gap-3">
          {(
            [
              { level: "critical", count: criticalRisks.length, color: "text-red-600" },
              { level: "high", count: highRisks.length, color: "text-orange-600" },
              { level: "medium", count: mediumRisks.length, color: "text-amber-600" },
              { level: "low", count: lowRisks.length, color: "text-emerald-600" },
            ] as const
          ).map(({ level, count, color }) => (
            <div
              key={level}
              className="rounded-lg border border-border bg-card p-3 text-center"
            >
              <p className={`text-2xl font-bold ${color}`}>{count}</p>
              <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                {level}
              </p>
            </div>
          ))}
        </div>

        {risks.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 p-8 text-center">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              ✅ No active risks detected. Keep it up.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ label, items }) => (
              <section key={label}>
                <SectionHeader title={`${label} Risks`} className="mb-3" />
                <div className="space-y-2">
                  {items.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4"
                    >
                      <div>
                        <p className="font-medium">{r.label}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {r.description}
                        </p>
                      </div>
                      <RiskBadge level={r.level} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
