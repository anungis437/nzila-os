import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  isAdmittedProofOfClaim,
  isOpenProofOfClaim,
} from '@nzila/trustcore-trustops/claims'
import { classifyClaimBatch } from '@nzila/trustops-intelligence/claim-batch-classifier'
import { getClaims, getMandate } from '../../../../lib/mandates-store'

export const dynamic = 'force-dynamic'

interface Params {
  readonly params: Promise<{ readonly mandateId: string }>
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export default async function ClaimsPage({ params }: Params) {
  const { mandateId } = await params
  const mandate = getMandate(mandateId)
  if (!mandate) notFound()

  const claims = getClaims(mandateId)
  const open = claims.filter((c) => isOpenProofOfClaim(c.status))
  const admitted = claims.filter((c) => isAdmittedProofOfClaim(c.status))

  const result = classifyClaimBatch({
    items: claims.map((c) => ({
      classification: c.classification,
      status: c.status,
      amountCents: c.amountCents,
    })),
  })

  return (
    <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href={`/mandates/${mandateId}`} style={{ color: 'var(--accent)' }}>← {mandate.name}</Link>
      </nav>

      <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Proofs of claim</h1>

      <section
        style={{
          background: 'var(--sidebar-bg)',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.75rem',
          fontSize: '0.875rem',
        }}
      >
        <div><div style={{ color: '#64748b' }}>Items</div><strong>{result.itemCount}</strong></div>
        <div><div style={{ color: '#64748b' }}>Total filed</div><strong>{formatCents(result.totalAmountCents)}</strong></div>
        <div><div style={{ color: '#64748b' }}>Admitted</div><strong>{formatCents(result.admittedAmountCents)}</strong></div>
        <div><div style={{ color: '#64748b' }}>Open / Admitted / Other</div>
          <strong>{result.statusCounts.open} / {result.statusCounts.admitted} / {result.statusCounts.other}</strong>
        </div>
      </section>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Breakdown by classification</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '0.5rem' }}>Classification</th>
            <th style={{ padding: '0.5rem' }}>Count</th>
            <th style={{ padding: '0.5rem' }}>Total</th>
            <th style={{ padding: '0.5rem' }}>Admitted</th>
            <th style={{ padding: '0.5rem' }}>% of batch</th>
          </tr>
        </thead>
        <tbody>
          {result.breakdown.map((b) => (
            <tr key={b.classification} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{b.classification}</td>
              <td style={{ padding: '0.5rem' }}>{b.count}</td>
              <td style={{ padding: '0.5rem' }}>{formatCents(b.totalAmountCents)}</td>
              <td style={{ padding: '0.5rem' }}>{formatCents(b.admittedAmountCents)}</td>
              <td style={{ padding: '0.5rem' }}>{b.percentOfBatch.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Open claims ({open.length})</h2>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem', marginBottom: '2rem' }}>
        {open.map((c) => (
          <li
            key={c.id}
            style={{
              background: 'var(--sidebar-bg)',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: '0.75rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span><code>{c.id}</code> · {c.classification} · {c.status}</span>
            <strong>{formatCents(c.amountCents)}</strong>
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Admitted claims ({admitted.length})</h2>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
        {admitted.map((c) => (
          <li
            key={c.id}
            style={{
              background: 'var(--sidebar-bg)',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: '0.75rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span><code>{c.id}</code> · {c.classification}</span>
            <strong>{formatCents(c.amountCents)}</strong>
          </li>
        ))}
      </ul>
    </main>
  )
}
