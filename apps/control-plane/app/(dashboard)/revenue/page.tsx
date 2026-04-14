import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import { DollarSign, TrendingUp, CreditCard, BarChart3 } from "lucide-react";
import { getRevenueDashboardData } from "@/server/revenue-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Revenue — Nzila OS Control Plane",
  description: "Platform-wide revenue breakdown, per-app attribution, and subscription metrics.",
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

async function RevenueContent() {
  const data = await getRevenueDashboardData();
  const apps = Object.entries(data.byApp).sort(([, a], [, b]) => b.total - a.total);

  return (
    <div className="space-y-6">
      {/* Top-line metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Revenue"
          icon={<DollarSign className="h-5 w-5" />}
          value={formatCurrency(data.totalRevenue)}
          subtitle={`${data.eventCount} revenue events`}
        />
        <SummaryCard
          title="Subscription"
          icon={<CreditCard className="h-5 w-5" />}
          value={formatCurrency(data.breakdown.subscription)}
          subtitle="Recurring subscriptions"
        />
        <SummaryCard
          title="Usage"
          icon={<BarChart3 className="h-5 w-5" />}
          value={formatCurrency(data.breakdown.usage)}
          subtitle="Metered usage & overages"
        />
        <SummaryCard
          title="Transactions"
          icon={<TrendingUp className="h-5 w-5" />}
          value={formatCurrency(data.breakdown.transaction)}
          subtitle="One-time & commerce"
        />
      </div>

      {/* Per-app breakdown */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Revenue by App
        </h2>
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">App</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Revenue</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Events</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Share</th>
              </tr>
            </thead>
            <tbody>
              {apps.map(([appName, info]) => {
                const share = data.totalRevenue > 0
                  ? Math.round((info.total / data.totalRevenue) * 100)
                  : 0;
                return (
                  <tr key={appName} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{appName}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {formatCurrency(info.total)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{info.count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">
                          {share}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function RevenuePage() {
  return (
    <>
      <PageHeader
        title="Platform Revenue"
        description="Revenue aggregation, per-app attribution, and subscription/usage/transaction breakdown."
      />
      <Suspense fallback={<CardSkeleton count={4} />}>
        <RevenueContent />
      </Suspense>
    </>
  );
}
