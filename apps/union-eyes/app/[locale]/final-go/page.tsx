/**
 * Final GO — UnionEyes pilot summary.
 *
 * Pilot-focused single-screen GO posture for the pilot operator.
 *
 * Authority: docs/nzila-finalization/master-finalization-index.md
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Final GO — UnionEyes',
  description: 'Pilot-focused Final GO summary.',
};

interface Cert {
  tier: string;
  verdict: string;
  release_under_certification: string;
  areas: { area: string; state: string }[];
  anchors?: Record<string, string>;
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
  throw new Error('UE final-go: cannot locate repo root from ' + process.cwd());
}

async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8')) as T;
  } catch {
    return null;
  }
}

export default async function FinalGoPilotPage() {
  const root = await resolveRepoRoot();
  const certPath = path.join(
    root,
    'proof-artifacts',
    'finalization',
    'certifications',
    'pilot.json',
  );
  const cert = await readJson<Cert>(certPath);
  const proven = cert?.areas.filter((a) => a.state === 'PROVEN').length ?? 0;
  const na = cert?.areas.filter((a) => a.state === 'N/A').length ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Final GO — Pilot
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Pilot-focused certification view. Calm. Authority-anchored.
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Pilot tier verdict</h2>
        <p className="mt-3 text-sm text-gray-700">
          Verdict:{' '}
          <span className="font-medium">{cert?.verdict ?? '—'}</span>. Release:{' '}
          <span className="font-mono text-xs">
            {cert?.release_under_certification ?? '—'}
          </span>
          . Coverage: {proven} proven, {na} N/A.
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Anchors</h2>
        <ul className="mt-3 space-y-1 text-sm text-gray-700">
          {cert && cert.anchors
            ? Object.entries(cert.anchors).map(([name, id]) => (
                <li key={name}>
                  <span className="text-gray-500">{name}:</span>{' '}
                  <span className="font-mono text-xs">
                    {String(id).slice(0, 8)}
                  </span>
                </li>
              ))
            : null}
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Areas</h2>
        <ul className="mt-3 space-y-1 text-sm text-gray-700">
          {cert?.areas.map((a) => (
            <li key={a.area}>
              <span className="text-gray-500">{a.area}:</span>{' '}
              <span className="font-medium">{a.state}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-xs text-gray-500">
        Authority: docs/nzila-finalization/master-finalization-index.md
      </p>
    </div>
  );
}
