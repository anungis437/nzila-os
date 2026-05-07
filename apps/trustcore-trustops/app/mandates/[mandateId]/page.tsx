import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  TRUSTOPS_TERMINAL_STAGES,
  nextStages,
} from '@nzila/trustcore-trustops/fsm'
import { computeMandateProgress } from '@nzila/trustcore-trustops/progress'
import { getMandate } from '../../../lib/mandates-store'

export const dynamic = 'force-dynamic'

interface Params {
  readonly params: Promise<{ readonly mandateId: string }>
}

export default async function MandateDetailPage({ params }: Params) {
  const { mandateId } = await params
  const mandate = await getMandate(mandateId)
  if (!mandate) notFound()

  const progress = computeMandateProgress(mandate.stage)
  const candidates = nextStages(mandate.stage)
  const isTerminal = (TRUSTOPS_TERMINAL_STAGES as readonly string[]).includes(mandate.stage)

  return (
    <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/mandates" style={{ color: 'var(--accent)' }}>← All mandates</Link>
      </nav>

      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{mandate.name}</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Debtor: {mandate.debtorName}</p>

      <section
        style={{
          background: 'var(--sidebar-bg)',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <strong>Current stage</strong>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{progress}%</span>
        </div>
        <code style={{ display: 'block', marginTop: 4 }}>{mandate.stage}</code>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Advance stage</h2>
        {isTerminal ? (
          <p style={{ color: '#64748b' }}>Mandate is in a terminal stage; no further transitions allowed.</p>
        ) : candidates.length === 0 ? (
          <p style={{ color: '#64748b' }}>No allowed transitions from this stage.</p>
        ) : (
          <form
            method="POST"
            action={`/api/mandates/${mandate.id}/transition`}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}
          >
            {candidates.map((stage) => (
              <button
                key={stage}
                type="submit"
                name="toStage"
                value={stage}
                style={{
                  padding: '0.5rem 0.875rem',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                → {stage}
              </button>
            ))}
          </form>
        )}
      </section>

      <section style={{ display: 'flex', gap: '1rem' }}>
        <Link href={`/mandates/${mandate.id}/creditors`} style={{ color: 'var(--accent)' }}>
          Creditors →
        </Link>
        <Link href={`/mandates/${mandate.id}/claims`} style={{ color: 'var(--accent)' }}>
          Proofs of claim →
        </Link>
      </section>
    </main>
  )
}
