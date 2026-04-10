import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, DollarSign, Send, CheckCircle } from "lucide-react";
import { getProposals } from "@/server/deal-engine-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proposals — Nzila OS Deal Engine",
  description: "Deal proposals and pricing status.",
};

const statusBadge: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  viewed: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

async function ProposalsContent() {
  const proposals = await getProposals();

  if (proposals.length === 0) {
    return <EmptyState title="No proposals" message="Proposals will appear as deals progress past demo." />;
  }

  const accepted = proposals.filter((p) => p.status === "accepted").length;
  const sent = proposals.filter((p) => p.status === "sent" || p.status === "viewed").length;
  const totalValue = proposals.reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Total Proposals" icon={<FileText className="h-5 w-5" />} value={proposals.length} subtitle="all statuses" />
        <SummaryCard title="Accepted" icon={<CheckCircle className="h-5 w-5" />} value={accepted} subtitle={`${Math.round((accepted / proposals.length) * 100)}% win rate`} />
        <SummaryCard title="Pending" icon={<Send className="h-5 w-5" />} value={sent} subtitle="sent / viewed" />
        <SummaryCard title="Total Value" icon={<DollarSign className="h-5 w-5" />} value={`$${totalValue.toLocaleString()}`} subtitle="CAD" />
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">All Proposals</h2>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pricing Model</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pilot Pkg</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Conversion Ready</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Generated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {proposals.map((p) => (
              <tr key={p.id} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{p.accountName}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.pricingModel}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge[p.status] ?? statusBadge.draft}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">{p.amount != null ? `$${p.amount.toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3">{p.pilotPackageIssued ? <span className="text-emerald-600">✓</span> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3">{p.conversionPricingReady ? <span className="text-emerald-600">✓</span> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(p.generatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function ProposalsPage() {
  return (
    <>
      <PageHeader title="Proposals" description="Deal proposals, pricing models, and conversion readiness." />
      <Suspense fallback={<><CardSkeleton count={4} /><div className="mt-8"><TableSkeleton /></div></>}>
        <ProposalsContent />
      </Suspense>
    </>
  );
}
