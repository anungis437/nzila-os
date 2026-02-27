/**
 * CFO — Tax Tools Page (Server Component).
 *
 * Interactive tax calculators and data freshness dashboard:
 * - Late filing penalty estimator (ITA s.162, ETA s.280)
 * - Salary vs. dividend optimizer
 * - Data freshness monitor
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import { Calculator, BarChart3, ShieldCheck } from 'lucide-react'
import { PenaltyEstimator } from '@/components/tax-tools/penalty-estimator'
import { SalaryVsDividend } from '@/components/tax-tools/salary-vs-dividend'
import { DataFreshnessPanel } from '@/components/tax-tools/data-freshness-panel'
import { TaxDisclaimer } from '@/components/tax-disclaimer'

export default async function TaxToolsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('tax_tools:view')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-poppins text-2xl font-bold text-foreground">
          Tax Tools
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Interactive calculators powered by CRA public data — penalty estimator,
          salary vs. dividend optimizer, and data freshness monitoring.
        </p>
      </div>

      {/* Tool Cards Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Penalty Estimator */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-poppins text-sm font-semibold text-foreground">
                Late Filing Penalty Estimator
              </h3>
              <p className="text-xs text-muted-foreground">ITA s.162 &middot; ETA s.280</p>
            </div>
          </div>
          <PenaltyEstimator />
        </div>

        {/* Salary vs Dividend */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric/10 text-electric">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-poppins text-sm font-semibold text-foreground">
                Salary vs. Dividend Optimizer
              </h3>
              <p className="text-xs text-muted-foreground">CCPC owner-manager planning</p>
            </div>
          </div>
          <SalaryVsDividend />
        </div>
      </div>

      {/* Data Freshness — Full Width */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-poppins text-sm font-semibold text-foreground">
              CRA Data Freshness
            </h3>
            <p className="text-xs text-muted-foreground">
              Module verification status &middot; 90-day staleness threshold
            </p>
          </div>
        </div>
        <DataFreshnessPanel />
      </div>

      <TaxDisclaimer variant="full" />
    </div>
  )
}
