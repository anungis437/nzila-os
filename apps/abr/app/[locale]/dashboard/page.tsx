import Link from "next/link";
import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from "next/navigation";
import { Card } from "@nzila/ui";

// ── Data fetching ───────────────────────────────────────────────────────────

interface DashboardStats {
  activeCases: number | null;
  reportsGenerated: number | null;
  complianceScore: number | null;
  teamMembers: number | null;
}

async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const { db } = await import("@nzila/db");
    const { sql } = await import("drizzle-orm");

    const [casesResult, reportsResult, membersResult] = await Promise.allSettled([
      db.execute(sql`SELECT COUNT(*) as count FROM orgs WHERE type = 'case' AND status = 'active'`),
      db.execute(sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'report_generated'`),
      db.execute(sql`SELECT COUNT(*) as count FROM org_members`),
    ]);

    return {
      activeCases: casesResult.status === "fulfilled"
        ? Number((casesResult.value as unknown as { rows: { count: number }[] }).rows?.[0]?.count ?? 0)
        : null,
      reportsGenerated: reportsResult.status === "fulfilled"
        ? Number((reportsResult.value as unknown as { rows: { count: number }[] }).rows?.[0]?.count ?? 0)
        : null,
      complianceScore: null, // Computed metric — future phase
      teamMembers: membersResult.status === "fulfilled"
        ? Number((membersResult.value as unknown as { rows: { count: number }[] }).rows?.[0]?.count ?? 0)
        : null,
    };
  } catch {
    return { activeCases: null, reportsGenerated: null, complianceScore: null, teamMembers: null };
  }
}

function formatStat(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  return value.toLocaleString() + suffix;
}

const quickActions = [
  { label: "New Case", href: "cases/new", icon: "⚖️" },
  { label: "Generate Report", href: "reports/new", icon: "📋" },
  { label: "Run Analysis", href: "research", icon: "🔍" },
  { label: "View Alerts", href: "compliance/alerts", icon: "🔔" },
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
    { label: "Active Cases", value: formatStat(data.activeCases), change: data.activeCases !== null ? "Live from DB" : "No data yet" },
    { label: "Reports Generated", value: formatStat(data.reportsGenerated), change: data.reportsGenerated !== null ? "Live from DB" : "No data yet" },
    { label: "Compliance Score", value: formatStat(data.complianceScore, "%"), change: "Coming soon" },
    { label: "Team Members", value: formatStat(data.teamMembers), change: data.teamMembers !== null ? "Live from DB" : "No data yet" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">
          Welcome back
        </h2>
        <p className="mt-1 text-slate-500">
          Here&apos;s an overview of your legal intelligence workspace.
        </p>
      </div>

      {/* Stat cards */}
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

      {/* Quick actions */}
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
