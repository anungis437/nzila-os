import { AppLayout } from "@/components/layout/app-layout";
import { MetricCard } from "@/components/ui/metric-card";
import { RiskBadge } from "@/components/ui/risk-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { getDb } from "@/lib/db";
import { formatCurrency, formatDays } from "@/lib/utils";
import { calculateRunway, runwayStatus } from "@/domain/runway";
import { scoreRisks } from "@/domain/risk";
import { rankPriorities } from "@/domain/priorities";
import { computeRetentionInsights } from "@/lib/retention-intelligence";
import { shouldShowUpgradePrompt } from "@/lib/usage-limits";
import { CommercialActions } from "@/components/dashboard/commercial-actions";
import { Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";

interface CashSnapshot {
  cashOnHand: number;
  monthlyBurn: number;
  runwayDays: number;
  overdueInvoices: number;
}

async function getDashboardData() {
  const db = await getDb();
  if (!db) {
    return { snapshot: null, openDeals: 0, pipelineValue: 0, weeklyScores: [], subscription: null };
  }
  try {
    const { sql } = await import("drizzle-orm");
    const [snapRow, dealsRow, subRow, weeklyRow] = await Promise.allSettled([
      db.execute(
        sql`SELECT cash_on_hand, monthly_burn, runway_days, overdue_invoices FROM weekone_cash_snapshots ORDER BY recorded_at DESC LIMIT 1`
      ),
      db.execute(
        sql`SELECT COUNT(*) as count, COALESCE(SUM(value * probability / 100), 0) as weighted FROM weekone_deals WHERE stage != 'closed'`
      ),
      db.execute(
        sql`SELECT plan, status, current_period_end FROM weekone_subscriptions ORDER BY created_at DESC LIMIT 1`
      ),
      db.execute(
        sql`SELECT week_start_date as "weekStartDate", 70::int as score FROM weekone_weekly_briefs ORDER BY week_start_date DESC LIMIT 12`
      ),
    ]);

    const snapshot: CashSnapshot | null =
      snapRow.status === "fulfilled"
        ? ((snapRow.value as unknown as { rows: CashSnapshot[] }).rows?.[0] ??
          null)
        : null;

    const dealsData =
      dealsRow.status === "fulfilled"
        ? (
            dealsRow.value as unknown as {
              rows: { count: number; weighted: number }[];
            }
          ).rows?.[0]
        : null;

    return {
      snapshot,
      openDeals: Number(dealsData?.count ?? 0),
      pipelineValue: Number(dealsData?.weighted ?? 0),
      weeklyScores:
        weeklyRow.status === "fulfilled"
          ? ((weeklyRow.value as unknown as { rows: { weekStartDate: string; score: number }[] }).rows ?? [])
          : [],
      subscription:
        subRow.status === "fulfilled"
          ? (
              subRow.value as unknown as {
                rows: { plan: string; status: string; current_period_end: string | null }[];
              }
            ).rows?.[0] ?? null
          : null,
    };
  } catch {
    return { snapshot: null, openDeals: 0, pipelineValue: 0, weeklyScores: [], subscription: null };
  }
}

export default async function DashboardPage() {
  const { snapshot, openDeals, pipelineValue, weeklyScores, subscription } = await getDashboardData();

  const planLabel =
    subscription?.plan === "growth"
      ? "Growth"
      : subscription?.plan === "team"
      ? "Team"
      : subscription?.plan === "solo"
      ? "Solo"
      : "Free";

  const runwayDays = snapshot
    ? calculateRunway({
        cashOnHand: snapshot.cashOnHand,
        monthlyBurn: snapshot.monthlyBurn,
      })
    : null;

  const rStatus = runwayDays !== null ? runwayStatus(runwayDays) : "neutral";
  const planId =
    subscription?.plan === "growth"
      ? "pro"
      : subscription?.plan === "team"
      ? "team"
      : "free";

  const usageSnapshot = {
    prioritiesCreatedThisWeek: Math.max(0, openDeals * 2),
    collaborators: 1,
    integrationsConnected: subscription ? 1 : 0,
  };
  const showUpgradePrompt = shouldShowUpgradePrompt({
    plan: planId,
    usage: usageSnapshot,
  });
  const retention = computeRetentionInsights(weeklyScores);

  const risks =
    runwayDays !== null
      ? scoreRisks({
          runwayDays,
          overdueInvoicesCount: snapshot?.overdueInvoices ?? 0,
          openDealsCount: openDeals,
          prioritiesCount: 4,
          lastActivityDays: 7,
        })
      : [];

  const priorities =
    runwayDays !== null
      ? rankPriorities({
          runwayDays,
          pipelineValue,
          overdueInvoices: snapshot?.overdueInvoices ?? 0,
        })
      : [];

  const categoryColors: Record<string, string> = {
    revenue: "bg-electric/10 text-electric border-electric/20",
    risk: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400",
    delegation: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400",
    stop: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400",
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Good morning, Founder.
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here&apos;s what matters this week.
          </p>
        </div>

        {/* Top Metrics */}
        <section>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard
              title="Cash on Hand"
              value={
                snapshot ? formatCurrency(snapshot.cashOnHand) : "—"
              }
              subtitle="Current balance"
              status="neutral"
            />
            <MetricCard
              title="Runway"
              value={runwayDays !== null ? formatDays(runwayDays) : "—"}
              subtitle={runwayDays !== null ? `${rStatus}` : "No data yet"}
              status={
                rStatus === "neutral"
                  ? "neutral"
                  : (rStatus as "healthy" | "warning" | "critical")
              }
            />
            <MetricCard
              title="Monthly Burn"
              value={
                snapshot ? formatCurrency(snapshot.monthlyBurn) : "—"
              }
              subtitle="Per month"
              status="neutral"
            />
            <MetricCard
              title="Overdue Invoices"
              value={
                snapshot ? String(snapshot.overdueInvoices) : "—"
              }
              subtitle="Awaiting payment"
              status={
                snapshot && snapshot.overdueInvoices > 0
                  ? "warning"
                  : "neutral"
              }
            />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Priority Engine */}
          <section>
            <SectionHeader
              title="This Week's Priorities"
              subtitle="Ranked by impact"
              className="mb-4"
            />
            {priorities.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No priorities generated yet. Add cash and deal data to get
                started.
              </p>
            ) : (
              <div className="space-y-3">
                {priorities.map((p) => (
                  <div
                    key={p.rank}
                    className={`rounded-lg border p-4 ${categoryColors[p.category] ?? ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/60 text-xs font-bold dark:bg-black/20">
                        {p.rank}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{p.title}</p>
                        <p className="mt-0.5 text-xs opacity-80">
                          {p.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Risk Radar + Pipeline */}
          <div className="space-y-6">
            {/* Risk Radar */}
            <section>
              <SectionHeader
                title="Risk Radar"
                action={
                  <Link
                    href="/risks"
                    className="flex items-center gap-1 text-xs text-electric hover:underline"
                  >
                    View all <ChevronRight className="h-3 w-3" />
                  </Link>
                }
                className="mb-4"
              />
              {risks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No active risks detected.
                </p>
              ) : (
                <div className="space-y-2">
                  {risks.slice(0, 3).map((r, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{r.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {r.description}
                        </p>
                      </div>
                      <RiskBadge level={r.level} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Pipeline Summary */}
            <section>
              <SectionHeader
                title="Pipeline"
                action={
                  <Link
                    href="/growth"
                    className="flex items-center gap-1 text-xs text-electric hover:underline"
                  >
                    View all <ChevronRight className="h-3 w-3" />
                  </Link>
                }
                className="mb-4"
              />
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  title="Open Deals"
                  value={String(openDeals)}
                  status="neutral"
                />
                <MetricCard
                  title="Weighted Value"
                  value={openDeals > 0 ? formatCurrency(pipelineValue) : "—"}
                  status="neutral"
                />
              </div>
            </section>

            {/* Weekly Brief Teaser */}
            <section>
              <Link
                href="weekly"
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-electric/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-electric" />
                  <div>
                    <p className="text-sm font-medium">Weekly Brief</p>
                    <p className="text-xs text-muted-foreground">
                      View your latest founder memo
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </section>

            <section>
              <Link
                href="settings"
                className="flex items-center justify-between rounded-lg border border-electric/20 bg-electric/5 p-4 hover:border-electric/40 hover:shadow-sm transition-all"
              >
                <div>
                  <p className="text-sm font-medium">Plan Health</p>
                  <p className="text-xs text-muted-foreground">
                    Current plan: {planLabel}
                    {subscription?.current_period_end
                      ? ` · Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                      : " · Upgrade to unlock integrations and deeper analytics"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </section>

            <section>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium">Retention Intelligence</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Weeks completed</p>
                    <p className="text-base font-semibold">{retention.weeksCompleted}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Average score</p>
                    <p className="text-base font-semibold">{retention.averageScore}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Consistency</p>
                    <p className="text-base font-semibold">{retention.consistency}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Churn risk</p>
                    <p className="text-base font-semibold capitalize">{retention.churnRisk}</p>
                  </div>
                </div>
              </div>
            </section>

            {showUpgradePrompt && (
              <section>
                <div className="rounded-lg border border-electric/30 bg-electric/10 p-4">
                  <p className="text-sm font-medium text-electric">Upgrade recommended</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You are approaching usage limits on your current plan. Upgrade to unlock more collaborators and integrations.
                  </p>
                </div>
              </section>
            )}

            <CommercialActions />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
