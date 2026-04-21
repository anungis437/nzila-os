/**
 * /governance/executive — ExecutiveOS Governance hub.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { currentUser } from '@nzila/platform-auth/entra/server'

export const dynamic = 'force-dynamic'

export default async function GovernanceExecutivePage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">Governance · ExecutiveOS</h1>
        <p className="mt-2 text-sm text-slate-600">
          Audit trail integrity, statutory filings, evidence packs, governance actions.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/governance/executive/audit" className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Audit</h2>
          <p className="mt-1 text-sm text-slate-600">Evidence-pack chain, broken hashes, stale drafts, control-family coverage.</p>
          <p className="mt-3 text-xs text-slate-500">Reads: <code>evidence_packs</code></p>
        </Link>
        <Link href="/governance/executive/legal" className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Legal</h2>
          <p className="mt-1 text-sm text-slate-600">Overdue filings, compliance tasks, stuck governance approvals.</p>
          <p className="mt-3 text-xs text-slate-500">Reads: <code>filings</code>, <code>compliance_tasks</code>, <code>governance_actions</code></p>
        </Link>
        <Link href="/knowledge/steward" className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Knowledge Steward</h2>
          <p className="mt-1 text-sm text-slate-600">Stale documents, unlinked resolutions, empty categories.</p>
          <p className="mt-3 text-xs text-slate-500">Reads: <code>documents</code></p>
        </Link>
      </div>
    </main>
  )
}
