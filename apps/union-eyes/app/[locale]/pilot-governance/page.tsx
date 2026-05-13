/**
 * Pilot Governance — UnionEyes operational surface.
 *
 * Institutionally governable, not beta-software administration.
 *
 * Authority:
 *   docs/nzila-rollout-governance/pilot-governance-system.md
 *   docs/nzila-rollout-governance/master-rollout-governance-index.md
 */
import {
  loadEnvironmentRegistry,
  loadPilotLedger,
} from '@/lib/rollout-governance';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pilot Governance — UnionEyes',
  description:
    'Pilot legitimacy, onboarding readiness, continuity posture, and attestation readiness.',
};

export default async function PilotGovernancePage() {
  const [registry, ledger] = await Promise.all([
    loadEnvironmentRegistry(),
    loadPilotLedger(3),
  ]);
  const env = registry.environments.pilot;
  const lastPromotion = ledger.promotions[0] ?? null;
  const lastRollback = ledger.rollbacks[0] ?? null;

  let stabilizingMinutesRemaining = 0;
  if (lastPromotion && env.continuity_window_minutes > 0) {
    const remainingMs =
      Date.parse(lastPromotion.timestamp) +
      env.continuity_window_minutes * 60_000 -
      Date.now();
    if (remainingMs > 0)
      stabilizingMinutesRemaining = Math.ceil(remainingMs / 60_000);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Pilot Governance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Live institutional pilot posture. Reviewed jointly with the
          institutional sponsor.
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Environment identity
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-500">Topology</dt>
            <dd className="mt-1 font-mono text-xs text-gray-900">
              {env.topology}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Secret topology</dt>
            <dd className="mt-1 font-mono text-xs text-gray-900">
              {env.secret_topology}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Operator review</dt>
            <dd className="mt-1 text-gray-900">{env.operator_review}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Rollback policy</dt>
            <dd className="mt-1 text-gray-900">{env.rollback_policy}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-medium text-gray-900">
            Pilot legitimacy
          </h2>
          {lastPromotion ? (
            <div className="mt-3 text-sm">
              <p className="text-gray-900">
                Last promotion {lastPromotion.timestamp.slice(0, 19).replace('T', ' ')}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Release{' '}
                <span className="font-mono">
                  {lastPromotion.subject?.release_id ?? '—'}
                </span>{' '}
                · reviewer {lastPromotion.actor}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              No promotion attestation has been recorded for the pilot tier.
              Pilot is not yet provisioned.
            </p>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-medium text-gray-900">
            Continuity posture
          </h2>
          {stabilizingMinutesRemaining > 0 ? (
            <p className="mt-3 text-sm text-amber-700">
              Stabilizing — {stabilizingMinutesRemaining}m remaining in
              window ({env.continuity_window_minutes}m).
            </p>
          ) : (
            <p className="mt-3 text-sm text-gray-900">
              Outside stabilization window. Window {env.continuity_window_minutes}m.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Rollback posture</h2>
        {lastRollback ? (
          <p className="mt-3 text-sm text-gray-900">
            Last rollback {lastRollback.timestamp.slice(0, 19).replace('T', ' ')} ·
            reviewer {lastRollback.actor}
          </p>
        ) : (
          <p className="mt-3 text-sm text-gray-500">
            No rollback recorded for the pilot tier. Forward-only posture.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Onboarding readiness
        </h2>
        <p className="mt-3 text-sm text-gray-500">
          Onboarding governance is paced for institutional stabilization.
          Phases and review obligations are defined in the institutional
          onboarding governance document.
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm text-gray-700">
          <li>Pre-onboarding review: 5 business days</li>
          <li>Operator orientation: 3 business days</li>
          <li>Shadow operations: 5 business days</li>
          <li>Supervised live operations: 10 business days</li>
        </ul>
      </section>

      <p className="mt-10 text-xs text-gray-400">
        Authority: docs/nzila-rollout-governance/pilot-governance-system.md
      </p>
    </div>
  );
}
