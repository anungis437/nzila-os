import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Card } from "@nzila/ui";
import type { TaxBreakdown } from "@nzila/pricing-engine";

// ── Data fetching ───────────────────────────────────────────────────────────

interface DashboardStats {
  activeQuotes: number | null;
  totalRevenue: number | null;
  avgMargin: number | null;
  activeClients: number | null;
}

async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const { db, commerceQuotes, commerceCustomers } = await import("@nzila/db");
    const { sql, eq } = await import("drizzle-orm");

    const [quotesResult, revenueResult, clientsResult] = await Promise.allSettled([
      db.select({ count: sql<number>`count(*)` })
        .from(commerceQuotes)
        .where(eq(commerceQuotes.status, "draft")),
      db.select({ total: sql<number>`COALESCE(SUM(CAST(total AS NUMERIC)), 0)` })
        .from(commerceQuotes)
        .where(eq(commerceQuotes.status, "accepted")),
      db.select({ count: sql<number>`count(*)` }).from(commerceCustomers),
    ]);

    return {
      activeQuotes: quotesResult.status === "fulfilled" ? Number(quotesResult.value[0]?.count ?? 0) : null,
      totalRevenue: revenueResult.status === "fulfilled" ? Number(revenueResult.value[0]?.total ?? 0) : null,
      avgMargin: null, // Requires line-level cost data — future phase
      activeClients: clientsResult.status === "fulfilled" ? Number(clientsResult.value[0]?.count ?? 0) : null,
    };
  } catch {
    return { activeQuotes: null, totalRevenue: null, avgMargin: null, activeClients: null };
  }
}

function formatStat(value: number | null, isCurrency = false, isPercent = false): string {
  if (value === null) return "—";
  if (isCurrency) return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", notation: "compact" }).format(value);
  if (isPercent) return `${value}%`;
  return value.toLocaleString();
}

// Type reference to confirm pricing-engine integration
type _TaxCheck = TaxBreakdown;

const quickActions = [
  { label: "New Quote", href: "quotes/new", icon: "📋" },
  { label: "Import Products", href: "import", icon: "📦" },
  { label: "View Analytics", href: "analytics", icon: "📈" },
  { label: "Manage Clients", href: "clients", icon: "👥" },
];

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { locale } = await params;
  const basePath = `/${locale}/dashboard`;
  const data = await getDashboardStats();

  const statCards = [
    { label: "Active Quotes", value: formatStat(data.activeQuotes), change: data.activeQuotes !== null ? "Live from DB" : "No data yet", trend: "up" as const },
    { label: "Total Revenue", value: formatStat(data.totalRevenue, true), change: data.totalRevenue !== null ? "Live from DB" : "No data yet", trend: "up" as const },
    { label: "Avg Margin", value: formatStat(data.avgMargin, false, true), change: "Coming soon", trend: "up" as const },
    { label: "Active Clients", value: formatStat(data.activeClients), change: data.activeClients !== null ? "Live from DB" : "No data yet", trend: "neutral" as const },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">
          Welcome back
        </h2>
        <p className="mt-1 text-slate-500">
          Here&apos;s an overview of your quoting workspace.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <div className="p-6">
              <div className="text-sm font-medium text-slate-500">
                {card.label}
              </div>
              <div className="mt-2 font-poppins text-3xl font-bold text-navy">
                {card.value}
              </div>
              <div className="mt-1 text-xs text-slate-400">{card.change}</div>
            </div>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="font-poppins text-lg font-semibold text-navy">
          Quick Actions
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={`${basePath}/${action.href}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="font-poppins text-sm font-semibold text-navy">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
