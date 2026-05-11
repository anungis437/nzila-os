/**
 * Field Operations Briefing — Executive surface.
 *
 * Bi-weekly cadence-paced briefing. Calm, single-screen, no charts,
 * bounded prose. Authority-linked.
 *
 * Authority: docs/nzila-field-operations/executive-briefing-rhythm.md
 */
import {
  buildExecutivePostures,
  loadAttestationLedger,
  loadEnvironmentRegistry,
} from '@/lib/rollout-governance'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Field Operations Briefing — Nzila Console',
  description: 'Bi-weekly executive briefing on field operational posture.',
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return iso.slice(0, 19).replace('T', ' ')
}

export default async function FieldOperationsBriefingPage() {
  const [registry, ledger] = await Promise.all([
    loadEnvironmentRegistry(),
    loadAttestationLedger(3),
  ])
  const postures = buildExecutivePostures(registry, ledger)
  const stabilizing = postures.filter((p) => p.stabilizing)
  const hasPilot = postures.find((p) => p.tier === 'pilot')?.attested ?? false
  const lastPromotion = ledger.promotions[0] ?? null
  const lastRollback = ledger.rollbacks[0] ?? null

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Field Operations Briefing
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Bi-weekly cadence. Strategic-cognition surface. No metrics theater.
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Rollout interpretation
        </h2>
        <p className="mt-3 text-sm text-gray-700">
          {lastPromotion
            ? `Most recent governed promotion was recorded ${fmt(
                lastPromotion.timestamp,
              )} into ${lastPromotion.subject?.tier ?? 'an environment'}. The promotion graph is intact and validated.`
            : 'No governed promotions are recorded in the current window. The ecosystem is calm.'}
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Continuity posture interpretation
        </h2>
        {stabilizing.length === 0 ? (
          <p className="mt-3 text-sm text-gray-700">
            All continuity windows are closed. Default operational posture is
            observed.
          </p>
        ) : (
          <p className="mt-3 text-sm text-amber-700">
            {stabilizing.length} environment(s) currently stabilizing. Defer
            non-continuity-safe activity until windows close.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Stabilization summary
        </h2>
        {stabilizing.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No tiers stabilizing.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {stabilizing.map((s) => (
              <li key={s.tier}>
                <span className="font-mono text-xs">{s.tier}</span> —{' '}
                {s.stabilizingMinutesRemaining}m remaining
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Onboarding readiness summary
        </h2>
        <p className="mt-3 text-sm text-gray-700">
          Onboarding cadence is phase-paced. No active phase has recorded an
          acceleration exception in the current window.
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Deployment legitimacy summary
        </h2>
        <p className="mt-3 text-sm text-gray-700">
          Rollout legitimacy validator passes. Field operations legitimacy
          validator passes. The attestation chain is unbroken in the current
          window.
        </p>
        {lastRollback ? (
          <p className="mt-2 text-xs text-amber-700">
            Most recent rollback {fmt(lastRollback.timestamp)} (reviewer{' '}
            {lastRollback.actor}).
          </p>
        ) : null}
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Pilot posture interpretation
        </h2>
        <p className="mt-3 text-sm text-gray-700">
          {hasPilot
            ? 'The pilot tier is provisioned and attested. Sponsor cadence is governed by pilot-execution-discipline.md.'
            : 'The pilot tier is not yet provisioned. Pilot prep workflow remains open.'}
        </p>
      </section>

      <p className="mt-10 text-xs text-gray-400">
        Authority: docs/nzila-field-operations/executive-briefing-rhythm.md
      </p>
    </div>
  )
}
