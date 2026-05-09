/**
 * Rollout Readiness — Executive Briefing.
 *
 * Calm, sparse, executive-readable rollout posture across governed
 * environments. No telemetry walls. No deployment theater.
 *
 * Authority: docs/nzila-rollout-governance/environment-legitimacy-visibility.md
 */
import {
  buildExecutivePostures,
  loadAttestationLedger,
  loadEnvironmentRegistry,
} from '@/lib/rollout-governance'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Rollout Readiness — Nzila Console',
  description: 'Executive rollout briefing across governed environments.',
}

export default async function RolloutReadinessPage() {
  const [registry, ledger] = await Promise.all([
    loadEnvironmentRegistry(),
    loadAttestationLedger(3),
  ])
  const postures = buildExecutivePostures(registry, ledger)
  const stabilizing = postures.filter((p) => p.stabilizing)
  const recentRollbacks = ledger.rollbacks.slice(0, 3)

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Rollout Readiness</h1>
        <p className="mt-1 text-sm text-gray-500">
          Executive posture across governed environments. Stabilization-oriented.
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white">
        <ul className="divide-y divide-gray-100">
          {postures.map((p) => (
            <li key={p.tier} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-base font-medium text-gray-900">{p.tier}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {p.releaseId ?? 'no attested release in window'}
                </p>
              </div>
              <div className="text-right">
                {p.stabilizing ? (
                  <p className="text-sm font-medium text-amber-700">
                    stabilizing · {p.stabilizingMinutesRemaining}m left
                  </p>
                ) : p.attested ? (
                  <p className="text-sm font-medium text-emerald-700">attested</p>
                ) : (
                  <p className="text-sm font-medium text-gray-500">no attestation</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-medium text-gray-900">Continuity posture</h2>
          {stabilizing.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              All governed environments are outside their stabilization windows.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {stabilizing.map((p) => (
                <li key={p.tier} className="flex items-center justify-between">
                  <span className="text-gray-900">{p.tier}</span>
                  <span className="text-amber-700">
                    {p.stabilizingMinutesRemaining}m left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-medium text-gray-900">Recent rollbacks</h2>
          {recentRollbacks.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              No rollbacks recorded. Forward-only posture.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {recentRollbacks.map((r) => (
                <li key={r.attestation_id} className="text-gray-900">
                  {r.subject?.tier} ·{' '}
                  <span className="text-gray-500">
                    {r.timestamp.slice(0, 10)} · {r.actor}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="mt-10 text-xs text-gray-400">
        Authority: docs/nzila-rollout-governance/master-rollout-governance-index.md
      </p>
    </div>
  )
}
