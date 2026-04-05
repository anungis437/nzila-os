/**
 * CFO — Ledger Page (Server Component).
 *
 * Real-time general ledger view with journal entries,
 * account balances, and reconciliation trigger.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Scale,
} from 'lucide-react'
import { getLedgerEntries, type LedgerEntry } from '@/lib/actions/ledger-actions'
import { getFinancialOverview } from '@/lib/actions/ledger-actions'
import { ReconcileButton } from '@/components/action-buttons'

function formatCurrency(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; source?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('ledger:view')

  const params = await searchParams
  const page = Number(params.page ?? '1')

  const [ledger, overview] = await Promise.all([
    getLedgerEntries({ page, pageSize: 50, source: params.source }),
    getFinancialOverview(),
  ])

  const summaryCards = [
    {
      label: 'Total Debits',
      value: formatCurrency(ledger.totalDebits),
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Total Credits',
      value: formatCurrency(ledger.totalCredits),
      icon: TrendingUp,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Net Balance',
      value: formatCurrency(ledger.netBalance),
      icon: Scale,
      color: ledger.netBalance >= 0 ? 'text-emerald-500' : 'text-red-500',
      bg: ledger.netBalance >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
    {
      label: 'Journal Entries',
      value: ledger.entryCount.toLocaleString(),
      icon: BookOpen,
      color: 'text-electric',
      bg: 'bg-electric/10',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">
            General Ledger
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Double-entry journal with Stripe &amp; QuickBooks data
          </p>
        </div>
        <ReconcileButton />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg} ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="font-poppins text-xl font-bold text-foreground">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* QBO Financial Overview */}
      {overview && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-2 font-poppins text-sm font-semibold text-foreground">
            QuickBooks Financial Summary
          </h3>
          <pre className="overflow-x-auto text-xs text-muted-foreground">
            {JSON.stringify(overview, null, 2)}
          </pre>
        </div>
      )}

      {/* Ledger Table */}
      {ledger.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="font-poppins text-lg font-semibold text-foreground">
            No ledger entries yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect Stripe or QuickBooks to import transactions.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Account</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Debit</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Credit</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ledger.entries.map((entry: LedgerEntry) => (
                <tr key={entry.id} className="transition-colors hover:bg-secondary/30">
                  <td className="whitespace-nowrap px-4 py-3 text-foreground">
                    {entry.date ? new Date(entry.date).toLocaleDateString('en-CA') : '—'}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-foreground">
                    {entry.description}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.account}</td>
                  <td className="px-4 py-3 text-red-500">
                    {entry.debit ? formatCurrency(entry.debit) : ''}
                  </td>
                  <td className="px-4 py-3 text-emerald-500">
                    {entry.credit ? formatCurrency(entry.credit) : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.source === 'stripe'
                          ? 'bg-purple-500/10 text-purple-500'
                          : entry.source === 'qbo'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {entry.source}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {ledger.entryCount > 50 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <a
              href={`?page=${page - 1}`}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
            >
              Previous
            </a>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(ledger.entryCount / 50)}
          </span>
          {page * 50 < ledger.entryCount && (
            <a
              href={`?page=${page + 1}`}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
            >
              Next
            </a>
          )}
        </div>
      )}
    </div>
  )
}
