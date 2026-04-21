import { AppLayout } from "@/components/layout/app-layout";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeader } from "@/components/ui/section-header";
import { getDb } from "@/lib/db";
import { formatCurrency, formatDays } from "@/lib/utils";
import { calculateRunway, runwayStatus } from "@/domain/runway";

interface CashSnapshot {
  cashOnHand: number;
  monthlyBurn: number;
  runwayDays: number;
  overdueInvoices: number;
  upcomingBills: number;
  recordedAt: string;
}

interface Invoice {
  id: number;
  clientName: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: "draft" | "sent" | "overdue" | "paid";
}

async function getMoneyData() {
  const db = await getDb();
  if (!db) return { snapshot: null, invoices: [] };
  try {
    const { sql } = await import("drizzle-orm");
    const [snapRow, invoicesRow] = await Promise.allSettled([
      db.execute(
        sql`SELECT cash_on_hand, monthly_burn, runway_days, overdue_invoices, upcoming_bills, recorded_at FROM weekone_cash_snapshots ORDER BY recorded_at DESC LIMIT 1`
      ),
      db.execute(
        sql`SELECT id, client_name, amount, currency, due_date, status FROM weekone_invoices ORDER BY due_date ASC LIMIT 20`
      ),
    ]);
    return {
      snapshot:
        snapRow.status === "fulfilled"
          ? ((snapRow.value as unknown as { rows: CashSnapshot[] }).rows?.[0] ??
            null)
          : null,
      invoices:
        invoicesRow.status === "fulfilled"
          ? ((invoicesRow.value as unknown as { rows: Invoice[] }).rows ?? [])
          : [],
    };
  } catch {
    return { snapshot: null, invoices: [] };
  }
}

const statusColors: Record<string, string> = {
  paid: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  sent: "text-electric bg-electric/10",
  overdue: "text-red-600 bg-red-50 dark:bg-red-900/20",
  draft: "text-muted-foreground bg-muted",
};

export default async function MoneyPage() {
  const { snapshot, invoices } = await getMoneyData();

  const runwayDays = snapshot
    ? calculateRunway({
        cashOnHand: snapshot.cashOnHand,
        monthlyBurn: snapshot.monthlyBurn,
      })
    : null;
  const rStatus = runwayDays !== null ? runwayStatus(runwayDays) : "neutral";

  const hiringCount =
    snapshot && snapshot.monthlyBurn > 0
      ? Math.floor(snapshot.cashOnHand / (snapshot.monthlyBurn * 6))
      : null;

  const runwayPercent =
    runwayDays !== null && runwayDays !== Infinity
      ? Math.min(100, Math.round((runwayDays / 365) * 100))
      : runwayDays === Infinity
        ? 100
        : 0;

  const runwayBarColor =
    rStatus === "critical"
      ? "bg-red-500"
      : rStatus === "warning"
        ? "bg-amber-400"
        : "bg-emerald-500";

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Money</h1>
          <p className="mt-1 text-muted-foreground">
            Cash position and runway
          </p>
        </div>

        {/* Runway Display */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Runway
              </p>
              <p
                className={`mt-1 text-4xl font-bold ${
                  rStatus === "critical"
                    ? "text-red-600"
                    : rStatus === "warning"
                      ? "text-amber-600"
                      : "text-foreground"
                }`}
              >
                {runwayDays !== null ? formatDays(runwayDays) : "—"}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                rStatus === "critical"
                  ? "bg-red-100 text-red-700"
                  : rStatus === "warning"
                    ? "bg-amber-100 text-amber-700"
                    : rStatus === "healthy"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground"
              }`}
            >
              {rStatus === "neutral" ? "No data" : rStatus}
            </span>
          </div>
          <div className="runway-bar">
            <div
              className={`runway-bar-fill ${runwayBarColor}`}
              style={{ width: `${runwayPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Based on current burn rate
          </p>
        </section>

        {/* Metric Cards */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard
            title="Cash on Hand"
            value={snapshot ? formatCurrency(snapshot.cashOnHand) : "—"}
            status="neutral"
          />
          <MetricCard
            title="Monthly Burn"
            value={snapshot ? formatCurrency(snapshot.monthlyBurn) : "—"}
            status="neutral"
          />
          <MetricCard
            title="Overdue Invoices"
            value={snapshot ? String(snapshot.overdueInvoices) : "—"}
            status={
              snapshot && snapshot.overdueInvoices > 0 ? "warning" : "neutral"
            }
          />
          <MetricCard
            title="Upcoming Bills"
            value={
              snapshot ? formatCurrency(snapshot.upcomingBills) : "—"
            }
            status="neutral"
          />
        </section>

        {/* Hiring Affordability */}
        {hiringCount !== null && (
          <section className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium">Hiring Affordability</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You can afford approximately{" "}
              <strong className="text-foreground">{hiringCount}</strong>{" "}
              hire(s) at $5k/mo burn each with current runway.
            </p>
          </section>
        )}

        {!snapshot && (
          <section className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No cash snapshots yet. Add your first snapshot to start tracking.
            </p>
            <button className="mt-3 rounded-md bg-electric px-4 py-2 text-sm font-medium text-white hover:bg-electric/90">
              Add Snapshot
            </button>
          </section>
        )}

        {/* Invoice List */}
        <section>
          <SectionHeader
            title="Invoices"
            action={
              <button className="rounded-md bg-electric px-3 py-1.5 text-xs font-medium text-white hover:bg-electric/90">
                + Add Invoice
              </button>
            }
            className="mb-4"
          />
          {invoices.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No invoices yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Client
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Due
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="bg-card hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        {inv.clientName}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(inv.amount, inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[inv.status] ?? ""}`}
                        >
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
