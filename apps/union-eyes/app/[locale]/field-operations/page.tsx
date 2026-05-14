/**
 * Field Operations — UnionEyes pilot operator summary.
 *
 * Calm, sparse, single-screen view of the pilot operator's cadence
 * obligations, current continuity posture, and onboarding pacing.
 *
 * Authority:
 *   docs/nzila-field-operations/operator-cadence-system.md
 *   docs/nzila-field-operations/pilot-execution-discipline.md
 */
import {
  loadEnvironmentRegistry,
  loadPilotLedger,
} from '@/lib/rollout-governance';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Field Operations — UnionEyes',
  description:
    'Pilot operator cadence, continuity posture, and onboarding pacing.',
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 19).replace('T', ' ');
}

export default async function FieldOperationsPage() {
  const [registry, ledger] = await Promise.all([
    loadEnvironmentRegistry(),
    loadPilotLedger(3),
  ]);
  const env = registry.environments.pilot;
  const lastPromotion = ledger.promotions[0] ?? null;
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
        <h1 className="text-2xl font-semibold text-gray-900">
          Field Operations
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Pilot operator cadence. Stabilization-first. Calm by design.
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Daily light cadence
        </h2>
        <p className="mt-3 text-sm text-gray-700">
          Bounded to ~15 minutes. Review pilot continuity posture, recent
          attestations, and any open continuity window.
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm text-gray-700">
          <li>Continuity posture (this page)</li>
          <li>
            Pilot Governance · pilot legitimacy + onboarding readiness
          </li>
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Continuity posture
        </h2>
        {stabilizingMinutesRemaining > 0 ? (
          <p className="mt-3 text-sm text-amber-700">
            Stabilizing — {stabilizingMinutesRemaining}m remaining in window
            ({env.continuity_window_minutes}m). Defer non-continuity-safe
            activity.
          </p>
        ) : (
          <p className="mt-3 text-sm text-gray-900">
            Outside stabilization window. Default posture: observed.
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Last pilot promotion: {fmt(lastPromotion?.timestamp ?? null)}
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Onboarding pacing
        </h2>
        <p className="mt-3 text-sm text-gray-500">
          Phase-paced, minimum-bounded. Acceleration requires a recorded
          exception with sponsor + platform reviewer co-signature.
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm text-gray-700">
          <li>Pre-onboarding review (5 days)</li>
          <li>Operator orientation (3 days)</li>
          <li>Shadow operations (5 days)</li>
          <li>Supervised live operations (10 days)</li>
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Operator posture expectations
        </h2>
        <ul className="mt-3 list-disc pl-5 text-sm text-gray-700">
          <li>Operate calmly</li>
          <li>Defer to stabilization</li>
          <li>Record attestations promptly</li>
          <li>Escalate interpretively</li>
          <li>Avoid heroics</li>
        </ul>
      </section>

      <p className="mt-10 text-xs text-gray-400">
        Authority: docs/nzila-field-operations/operator-cadence-system.md
      </p>
    </div>
  );
}
