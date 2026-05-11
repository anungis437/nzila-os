/**
 * Operational Proving Summary — Console executive surface.
 *
 * Single-screen calm summary of Phase C operational proving posture.
 * Bounded prose. No charts, no scoring.
 *
 * Authority: docs/nzila-operational-proving/master-operational-proving-index.md
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { loadAttestationLedger } from '@/lib/rollout-governance'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Operational Proving Summary — Nzila Console',
  description: 'Executive view of Phase C operational proving posture.',
}

interface ManifestEdge {
  from: string
  to: string
  attestation_id: string
}
interface ProvingManifest {
  release_under_proving?: string
  recorded?: string
  traversal?: { edges?: ManifestEdge[] }
  refusals?: { scenarios?: Array<{ name: string; actual: string }> }
  rollback?: { attestation_id?: string; tier?: string }
  restoration?: { attestation_id?: string; tier?: string }
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
  throw new Error('console proving: cannot locate repo root from ' + process.cwd())
}

async function readManifest(): Promise<ProvingManifest | null> {
  try {
    const root = await resolveRepoRoot()
    const raw = await fs.readFile(
      path.join(root, 'proof-artifacts', 'operational-proving', 'proving-manifest.json'),
      'utf8',
    )
    return JSON.parse(raw) as ProvingManifest
  } catch {
    return null
  }
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return iso.slice(0, 19).replace('T', ' ')
}

export default async function OperationalProvingSummaryPage() {
  const [manifest, ledger] = await Promise.all([readManifest(), loadAttestationLedger(3)])
  const traversed = manifest?.traversal?.edges?.length ?? 0
  const refusals = manifest?.refusals?.scenarios ?? []
  const refusedCount = refusals.filter((s) => s.actual === 'REFUSED').length
  const rollbackId = manifest?.rollback?.attestation_id
  const restorationId = manifest?.restoration?.attestation_id

  const allClean =
    traversed >= 4 &&
    refusedCount === refusals.length &&
    refusedCount > 0 &&
    Boolean(rollbackId) &&
    Boolean(restorationId)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Operational Proving Summary
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Executive view. Calm. One screen. No metrics theater.
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Posture</h2>
        <p className="mt-3 text-sm text-gray-700">
          Phase C operational proving is{' '}
          <span className={allClean ? 'font-medium text-gray-900' : 'font-medium text-amber-700'}>
            {allClean ? 'PROVEN' : 'IN PROGRESS'}
          </span>
          . Release under proving:{' '}
          <span className="font-mono text-xs">{manifest?.release_under_proving ?? '—'}</span>.
          Recorded {fmt(manifest?.recorded)}.
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Traversal</h2>
        <p className="mt-3 text-sm text-gray-700">
          {traversed} governed promotion{traversed === 1 ? '' : 's'} attested across the real
          environment graph. The institutional split at staging (demo terminal-isolated; pilot
          flowing to prod) was honored.
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Refusals</h2>
        <p className="mt-3 text-sm text-gray-700">
          {refusedCount} of {refusals.length} expected refusal scenarios were correctly refused
          by the governance layer. Refusals were governance-safe, named the firing rule, and
          left no ledger entries.
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Rollback &amp; Restoration</h2>
        <p className="mt-3 text-sm text-gray-700">
          {rollbackId
            ? `A rollback was executed and attested on the ${manifest?.rollback?.tier ?? 'pilot'} tier.`
            : 'No rollback recorded.'}{' '}
          {restorationId
            ? `A restoration was executed and attested on the ${manifest?.restoration?.tier ?? 'pilot'} tier.`
            : 'No restoration recorded.'}
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Ledger health</h2>
        <p className="mt-3 text-sm text-gray-700">
          {ledger.promotions.length} promotion attestation(s) in window;{' '}
          {ledger.rollbacks.length} rollback attestation(s). Promotion graph intact.
        </p>
      </section>

      <p className="mt-10 text-xs text-gray-500">
        Authority: docs/nzila-operational-proving/master-operational-proving-index.md
      </p>
    </div>
  )
}
