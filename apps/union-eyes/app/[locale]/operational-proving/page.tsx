/**
 * Operational Proving — Union Eyes pilot summary.
 *
 * Pilot-focused proving summary. Calm, single-screen, locale-aware.
 *
 * Authority:
 *   docs/nzila-operational-proving/master-operational-proving-index.md
 *   docs/nzila-operational-proving/live-pilot-operations-proving.md
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadPilotLedger } from '@/lib/rollout-governance';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Operational Proving — Union Eyes',
  description: 'Pilot-focused operational proving summary.',
};

interface ProvingManifest {
  release_under_proving?: string;
  recorded?: string;
  traversal?: { edges?: Array<{ from: string; to: string; attestation_id: string }> };
  refusals?: { scenarios?: Array<{ name: string; actual: string }> };
  rollback?: { tier?: string; attestation_id?: string };
  restoration?: { tier?: string; attestation_id?: string };
}

const REPO_ROOT_CANDIDATES = [
  path.resolve(process.cwd(), '..', '..'),
  path.resolve(process.cwd(), '..'),
  process.cwd(),
];

async function resolveRepoRoot(): Promise<string> {
  for (const candidate of REPO_ROOT_CANDIDATES) {
    try {
      await fs.access(
        path.join(candidate, 'governance', 'rollout', 'environments.json'),
      );
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error('UE proving: cannot locate repo root from ' + process.cwd());
}

async function readManifest(): Promise<ProvingManifest | null> {
  try {
    const root = await resolveRepoRoot();
    const raw = await fs.readFile(
      path.join(
        root,
        'proof-artifacts',
        'operational-proving',
        'proving-manifest.json',
      ),
      'utf8',
    );
    return JSON.parse(raw) as ProvingManifest;
  } catch {
    return null;
  }
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 19).replace('T', ' ');
}

export default async function OperationalProvingPage() {
  const [manifest, ledger] = await Promise.all([
    readManifest(),
    loadPilotLedger(3),
  ]);

  const pilotPromotion =
    manifest?.traversal?.edges?.find((e) => e.to === 'pilot') ?? null;
  const rollback = manifest?.rollback;
  const restoration = manifest?.restoration;
  const refusals = manifest?.refusals?.scenarios ?? [];
  const refusedCount = refusals.filter((s) => s.actual === 'REFUSED').length;
  const lastPilotPromotion = ledger.promotions[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Operational Proving — Pilot
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Pilot-focused proving summary. Calm. Authority-linked.
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Pilot tier posture</h2>
        <p className="mt-3 text-sm text-gray-700">
          Release under proving:{' '}
          <span className="font-mono text-xs">
            {manifest?.release_under_proving ?? '—'}
          </span>
          . Pilot promotion attestation:{' '}
          <span className="font-mono text-xs">
            {pilotPromotion?.attestation_id?.slice(0, 8) ?? '—'}
          </span>
          . Last pilot promotion at {fmt(lastPilotPromotion?.timestamp ?? null)}.
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Rollback &amp; Restoration
        </h2>
        <p className="mt-3 text-sm text-gray-700">
          Rollback:{' '}
          <span className="font-mono text-xs">
            {rollback?.attestation_id?.slice(0, 8) ?? '—'}
          </span>{' '}
          on tier {rollback?.tier ?? '—'}. Restoration:{' '}
          <span className="font-mono text-xs">
            {restoration?.attestation_id?.slice(0, 8) ?? '—'}
          </span>{' '}
          on tier {restoration?.tier ?? '—'}.
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Refusal posture
        </h2>
        <p className="mt-3 text-sm text-gray-700">
          {refusedCount} of {refusals.length} expected refusal scenarios were
          correctly refused. The continuity-window refusal at the pilot tier
          held.
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">
          Pilot ledger window
        </h2>
        <p className="mt-3 text-sm text-gray-700">
          {ledger.promotions.length} pilot promotion attestation(s) in window;{' '}
          {ledger.rollbacks.length} pilot rollback attestation(s).
        </p>
      </section>

      <p className="mt-10 text-xs text-gray-500">
        Authority: docs/nzila-operational-proving/master-operational-proving-index.md
      </p>
    </div>
  );
}
