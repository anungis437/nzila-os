/**
 * /platform/executive — ExecutiveOS Platform hub.
 *
 * Landing page linking Reliability, Release Guard, FinOps, Security.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { currentUser } from '@nzila/platform-auth/entra/server'

export const dynamic = 'force-dynamic'

export default async function PlatformExecutivePage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">Platform · ExecutiveOS</h1>
        <p className="mt-2 text-sm text-slate-600">
          Platform reliability, release hygiene, cloud spend, and supply-chain security.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/platform/executive/reliability" className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Reliability</h2>
          <p className="mt-1 text-sm text-slate-600">SLO burn, p95 latency, open P1s, SLA breaches, root-cause debt.</p>
          <p className="mt-3 text-xs text-slate-500">Reads: <code>itsm_tickets</code>, <code>itsm_problems</code>, <code>platform_request_metrics</code></p>
        </Link>

        <Link href="/platform/executive/release-guard" className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Release Guard</h2>
          <p className="mt-1 text-sm text-slate-600">Change approvals, rollback plans, checklist completion, stale proposals.</p>
          <p className="mt-3 text-xs text-slate-500">Reads: <code>itsm_changes</code></p>
        </Link>

        <Link href="/platform/executive/finops" className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">FinOps</h2>
          <p className="mt-1 text-sm text-slate-600">Budget breaches, category growth, top spenders, MTD vs budget.</p>
          <p className="mt-3 text-xs text-slate-500">Reads: <code>platform_cost_rollups</code>, <code>platform_cost_budget_breaches</code></p>
        </Link>

        <Link href="/platform/executive/security" className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Security</h2>
          <p className="mt-1 text-sm text-slate-600">Open CVEs, waiver expiries, scan freshness.</p>
          <p className="mt-3 text-xs text-slate-500">Reads: host-built signal from <code>tooling/security/supply-chain-policy</code></p>
        </Link>
      </div>
    </main>
  )
}
