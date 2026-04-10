import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Handshake, DollarSign, TrendingUp } from "lucide-react";
import { getReferrals, getPartnerStats } from "@/server/deal-engine-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Partners — Nzila OS Deal Engine",
  description: "Partner referral pipeline and commission tracking.",
};

async function PartnersContent() {
  const [referrals, stats] = await Promise.all([getReferrals(), getPartnerStats()]);

  if (referrals.length === 0) {
    return <EmptyState title="No partner referrals" message="Partner referrals will appear when partners submit leads." />;
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total Referrals"
          icon={<Handshake className="h-5 w-5" />}
          value={stats.totalReferrals}
          subtitle={`${stats.convertedReferrals} converted`}
        />
        <SummaryCard
          title="Conversion Rate"
          icon={<TrendingUp className="h-5 w-5" />}
          value={`${stats.totalReferrals > 0 ? Math.round((stats.convertedReferrals / stats.totalReferrals) * 100) : 0}%`}
          subtitle="referral to converted"
        />
        <SummaryCard
          title="Total Commissions"
          icon={<DollarSign className="h-5 w-5" />}
          value={`$${stats.totalCommissionsEarned.toLocaleString()}`}
          subtitle="earned / pending"
        />
      </div>

      {stats.topPartners.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Top Partners</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {stats.topPartners.map((p) => (
              <div key={p.partnerId} className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-medium text-foreground">{p.partnerName}</h3>
                <p className="text-sm text-muted-foreground mt-1">{p.dealCount} deal{p.dealCount !== 1 ? "s" : ""} — ${p.totalValue.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">All Referrals</h2>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Partner</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Commission</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Referred</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {referrals.map((ref) => (
              <tr key={ref.id} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{ref.partnerName}</td>
                <td className="px-4 py-3 text-muted-foreground">{ref.accountName}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                    ref.referralStatus === "converted" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                    ref.referralStatus === "qualified" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                    "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                  }`}>
                    {ref.referralStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {ref.commissionAmount != null ? `$${ref.commissionAmount.toLocaleString()} (${ref.commissionStatus})` : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(ref.referredAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function PartnersPage() {
  return (
    <>
      <PageHeader
        title="Partners"
        description="Partner referral pipeline and commission tracking."
      />
      <Suspense fallback={<><CardSkeleton count={3} /><div className="mt-8"><TableSkeleton /></div></>}>
        <PartnersContent />
      </Suspense>
    </>
  );
}
