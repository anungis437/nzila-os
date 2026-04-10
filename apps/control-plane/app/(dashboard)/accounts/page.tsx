import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import { DealStageBadge } from "@/components/deal-engine/deal-stage-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2, Activity, Rocket, AlertTriangle } from "lucide-react";
import { getAccounts } from "@/server/deal-engine-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Accounts — Nzila OS Deal Engine",
  description: "Unified account view across the deal lifecycle.",
};

async function AccountsContent() {
  const accounts = await getAccounts();

  if (accounts.length === 0) {
    return <EmptyState title="No accounts" message="Accounts will appear as deals are created." />;
  }

  const withPilot = accounts.filter((a) => a.activePilot).length;
  const blocked = accounts.filter((a) => a.currentBlocker != null).length;
  const avgHealth = accounts
    .filter((a) => a.healthScore != null)
    .reduce((s, a, _, arr) => s + (a.healthScore ?? 0) / arr.length, 0);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Total Accounts" icon={<Building2 className="h-5 w-5" />} value={accounts.length} subtitle="across products" />
        <SummaryCard title="Active Pilots" icon={<Rocket className="h-5 w-5" />} value={withPilot} subtitle="accounts with pilots" />
        <SummaryCard title="Avg. Health" icon={<Activity className="h-5 w-5" />} value={avgHealth > 0 ? `${Math.round(avgHealth)}%` : "—"} subtitle="of scored accounts" />
        <SummaryCard title="Blocked" icon={<AlertTriangle className="h-5 w-5" />} value={blocked} subtitle="accounts with blockers" />
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">All Accounts</h2>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stage</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Products</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Owner</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Partner</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Health</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Next Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {accounts.map((a) => (
              <tr key={a.id} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{a.name}</td>
                <td className="px-4 py-3">{a.dealStage ? <DealStageBadge stage={a.dealStage} /> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{a.productFootprint.join(", ")}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.owner ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.partnerSource ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {a.healthScore != null ? (
                    <span className={a.healthScore >= 70 ? "text-emerald-600 font-medium" : a.healthScore >= 40 ? "text-amber-600" : "text-red-600 font-medium"}>
                      {a.healthScore}%
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{a.nextAction ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AccountsPage() {
  return (
    <>
      <PageHeader title="Accounts" description="Unified account view — deals, pilots, health, and blockers." />
      <Suspense fallback={<><CardSkeleton count={4} /><div className="mt-8"><TableSkeleton /></div></>}>
        <AccountsContent />
      </Suspense>
    </>
  );
}
