import type { SeedRng, SeedTime } from '../core/types'
import type { SyntheticOrganization } from './organizations'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

export interface SyntheticInvoice {
  readonly id: string
  readonly orgId: string
  readonly number: string
  readonly amountCents: number
  readonly currency: 'USD' | 'EUR' | 'CAD' | 'ZAR'
  readonly status: InvoiceStatus
  readonly issuedAt: string
  readonly dueAt: string
  readonly paidAt: string | null
}

export interface FakeInvoicesArgs {
  readonly rng: SeedRng
  readonly time: SeedTime
  readonly organizations: readonly SyntheticOrganization[]
  readonly count: number
}

/**
 * Realistic invoice mix: ~55% paid, ~25% sent, ~12% overdue, ~8% draft —
 * this drives believable AR-aging dashboards.
 */
export function fakeInvoices(args: FakeInvoicesArgs): SyntheticInvoice[] {
  const { rng, time, organizations, count } = args
  if (organizations.length === 0) {
    throw new Error('fakeInvoices: at least one organization is required')
  }
  const today = time.today().getTime()
  const out: SyntheticInvoice[] = []

  for (let i = 0; i < count; i++) {
    const org = organizations[i % organizations.length]!
    const r = rng.next()
    const status: InvoiceStatus = r < 0.55 ? 'paid' : r < 0.8 ? 'sent' : r < 0.92 ? 'overdue' : 'draft'
    const ageDays = rng.intBetween(0, 365)
    const issuedAt = time.daysAgo(ageDays)
    const dueAt = new Date(issuedAt.getTime() + 30 * 86_400_000)
    let paidAt: string | null = null
    if (status === 'paid') {
      const paidOffset = rng.intBetween(1, 28)
      const paidDate = Math.min(issuedAt.getTime() + paidOffset * 86_400_000, today)
      paidAt = new Date(paidDate).toISOString()
    }
    out.push({
      id: rng.id('inv'),
      orgId: org.id,
      number: `INV-${(10_000 + i).toString()}`,
      amountCents: rng.intBetween(50, 25_000) * 100,
      currency: rng.pick(['USD', 'EUR', 'CAD', 'ZAR'] as const),
      status,
      issuedAt: issuedAt.toISOString(),
      dueAt: dueAt.toISOString(),
      paidAt,
    })
  }
  return out
}
