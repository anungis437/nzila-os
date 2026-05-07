import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  CREDITOR_PRIORITY_ORDER,
  compareCreditorPriority,
} from '@nzila/trustcore-trustops/creditors'
import type { CreditorClassification } from '@nzila/trustcore-contracts'
import { getCreditors, getMandate } from '../../../../lib/mandates-store'

export const dynamic = 'force-dynamic'

interface Params {
  readonly params: Promise<{ readonly mandateId: string }>
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export default async function CreditorsPage({ params }: Params) {
  const { mandateId } = await params
  const mandate = getMandate(mandateId)
  if (!mandate) notFound()

  const creditors = [...getCreditors(mandateId)].sort((a, b) =>
    compareCreditorPriority(a.classification, b.classification),
  )

  const grouped = new Map<CreditorClassification, typeof creditors>()
  for (const c of creditors) {
    const existing = grouped.get(c.classification) ?? []
    existing.push(c)
    grouped.set(c.classification, existing)
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href={`/mandates/${mandateId}`} style={{ color: 'var(--accent)' }}>← {mandate.name}</Link>
      </nav>

      <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Creditors (priority order)</h1>

      {CREDITOR_PRIORITY_ORDER.map((classification) => {
        const items = grouped.get(classification) ?? []
        if (items.length === 0) return null
        return (
          <section key={classification} style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
              {classification}
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
              {items.map((c) => (
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
                  <span>{c.name}</span>
                  <strong>{formatCents(c.claimAmountCents)}</strong>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </main>
  )
}
