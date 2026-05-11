import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@nzila/platform-auth/entra/server'
import { computeMandateProgress } from '@nzila/trustcore-trustops/progress'
import { listMandates } from '../../lib/mandates-store'
import { getOrganizationIdForUser } from '../../lib/organization-utils'

export const dynamic = 'force-dynamic'

export default async function MandatesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const orgId = await getOrganizationIdForUser(userId)
  if (!orgId) redirect('/select-organization')
  const mandates = await listMandates(orgId)
  return (
    <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Mandates</h1>
      <p style={{ color: 'var(--foreground)', opacity: 0.7, marginBottom: '1.5rem' }}>
        Active insolvency mandates across this organization.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.75rem' }}>
        {mandates.map((m) => {
          const progress = computeMandateProgress(m.stage)
          return (
            <li
              key={m.id}
              style={{
                background: 'var(--sidebar-bg)',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '1rem 1.25rem',
              }}
            >
              <Link
                href={`/mandates/${m.id}`}
                style={{ textDecoration: 'none', color: 'var(--foreground)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: '1.05rem' }}>{m.name}</strong>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{progress}%</span>
                </div>
                <div style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 4 }}>
                  Debtor: {m.debtorName} · Stage: <code>{m.stage}</code>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
