import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function AuditPage() {
  const chainSteps = [
    { step: 'Record Ingested', status: 'verified', detail: 'Decision payload sealed and signed' },
    { step: 'Immutable Storage', status: 'verified', detail: 'WORM policy + legal hold applied' },
    { step: 'Chain Continuity', status: 'verified', detail: 'Previous hash linked per organization' },
    { step: 'External Verification', status: 'verified', detail: 'Export pack checksum + signature valid' },
  ]

  return (
    <main className="space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-slate-500">Decision Proof Ledger</p>
        <h1 className="text-3xl font-semibold text-slate-900">Audit Records</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          This surface exposes the non-bypassable decision audit APIs managed by Control Plane.
          This record is immutable and independently verifiable.
        </p>
      </header>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <p className="text-sm font-semibold">Verification Status</p>
        <p className="mt-1 text-sm">All new decision records are written with immutable retention and linked hash-chain continuity.</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Chain Visualization</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {chainSteps.map((item) => (
            <article key={item.step} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">{item.step}</p>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {item.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Create Record</h2>
          <p className="mt-2 text-sm text-slate-600">Persist a signed NAR record from a decision payload.</p>
          <Link className="mt-3 inline-block text-sm font-medium text-blue-700 hover:text-blue-900" href="/api/audit/record">
            /api/audit/record
          </Link>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Verify Record</h2>
          <p className="mt-2 text-sm text-slate-600">Recompute the hash and validate signature integrity.</p>
          <Link className="mt-3 inline-block text-sm font-medium text-blue-700 hover:text-blue-900" href="/api/audit/verify">
            /api/audit/verify
          </Link>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Export Pack</h2>
          <p className="mt-2 text-sm text-slate-600">Generate an organization-scoped signed pack (JSON or ZIP) for external audit.</p>
          <Link className="mt-3 inline-block text-sm font-medium text-blue-700 hover:text-blue-900" href="/api/audit/export?orgId=ORG_ID&format=zip">
            /api/audit/export
          </Link>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Auditor Access</h2>
          <p className="mt-2 text-sm text-slate-600">Issue time-bound read-only auditor tokens scoped to a single organization.</p>
          <Link className="mt-3 inline-block text-sm font-medium text-blue-700 hover:text-blue-900" href="/api/audit/auditor-access">
            /api/audit/auditor-access
          </Link>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Verification CLI</h2>
          <p className="mt-2 text-sm text-slate-600">Validate exported packs independently using checksum, signature, and chain checks.</p>
          <p className="mt-3 text-xs font-mono text-slate-700">pnpm audit:pack:verify -- --input=./audit-pack.zip</p>
        </article>
      </section>
    </main>
  )
}
