/**
 * Final GO Briefing — Console executive surface.
 *
 * Single-screen calm summary of Phase D GO status. Bounded prose.
 * No charts, no scoring, no launch theater.
 *
 * Authority: docs/nzila-finalization/master-finalization-index.md
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Final GO Briefing — Nzila Console',
  description: 'Executive view of Phase D Final GO status.',
}

interface Cert {
  tier: string
  verdict: string
  release_under_certification: string
  areas: { area: string; state: string }[]
}

const REPO_ROOT_CANDIDATES = [
  path.resolve(process.cwd(), '..', '..'),
  path.resolve(process.cwd(), '..'),
  process.cwd(),
]

async function resolveRepoRoot(): Promise<string> {
  for (const candidate of REPO_ROOT_CANDIDATES) {
    try {
      await fs.access(path.join(candidate, 'governance', 'rollout', 'environments.json'))
      return candidate
    } catch {
      // try next
    }
  }
  throw new Error('console final-go: cannot locate repo root from ' + process.cwd())
}

async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8')) as T
  } catch {
    return null
  }
}

const TIERS = ['dev', 'staging', 'demo', 'pilot', 'prod'] as const

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return iso.slice(0, 19).replace('T', ' ')
}

export default async function FinalGoBriefingPage() {
  const root = await resolveRepoRoot()
  const finalizationDir = path.join(root, 'proof-artifacts', 'finalization')
  const manifest = await readJson<{
    recorded?: string
    release_under_certification?: string
  }>(path.join(finalizationDir, 'finalization-manifest.json'))

  const certifications: Cert[] = []
  for (const tier of TIERS) {
    const c = await readJson<Cert>(
      path.join(finalizationDir, 'certifications', `${tier}.json`),
    )
    if (c) certifications.push(c)
  }

  const allGo =
    certifications.length === TIERS.length && certifications.every((c) => c.verdict === 'GO')

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Final GO Briefing</h1>
        <p className="mt-1 text-sm text-gray-500">
          Executive view. One screen. Calm. Authority-anchored.
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Posture</h2>
        <p className="mt-3 text-sm text-gray-700">
          Phase D operating system finalization is{' '}
          <span className={allGo ? 'font-medium text-gray-900' : 'font-medium text-amber-700'}>
            {allGo ? 'CERTIFIED' : 'IN PROGRESS'}
          </span>
          . Release under certification:{' '}
          <span className="font-mono text-xs">
            {manifest?.release_under_certification ?? '—'}
          </span>
          . Recorded {fmt(manifest?.recorded)}.
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Per-environment status</h2>
        <ul className="mt-3 space-y-1 text-sm text-gray-700">
          {certifications.map((c) => (
            <li key={c.tier}>
              <span className="font-mono text-xs">{c.tier}</span>:{' '}
              <span className="font-medium">{c.verdict}</span> —{' '}
              {c.areas.filter((a) => a.state === 'PROVEN').length} proven,{' '}
              {c.areas.filter((a) => a.state === 'N/A').length} N/A
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Interpretation</h2>
        <p className="mt-3 text-sm text-gray-700">
          The institutional operating system is converged, operationally proven,
          continuity-safe, and production-certified. The ecosystem reads as one
          system across Control Plane, Console, and Union Eyes. Quiet operations
          remain healthy operations.
        </p>
      </section>

      <p className="mt-10 text-xs text-gray-500">
        Authority: docs/nzila-finalization/master-finalization-index.md
      </p>
    </div>
  )
}
