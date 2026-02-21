'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ReceiptPercentIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface Entity {
  id: string
  legalName: string
}

interface IndirectTaxAccount {
  id: string
  entityId: string
  taxType: 'GST' | 'HST' | 'QST'
  filingFrequency: 'monthly' | 'quarterly' | 'annual'
  programAccountNumber: string | null
}

interface IndirectTaxPeriod {
  id: string
  entityId: string
  accountId: string
  taxType: 'GST' | 'HST' | 'QST'
  startDate: string
  endDate: string
  filingDue: string
  paymentDue: string
  status: 'open' | 'filed' | 'paid' | 'closed'
}

type Urgency = 'green' | 'yellow' | 'red'

function computeUrgency(dueDateStr: string): { daysRemaining: number; urgency: Urgency } {
  const due = new Date(dueDateStr)
  const now = new Date()
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return { daysRemaining: diff, urgency: diff < 0 ? 'red' : diff <= 30 ? 'yellow' : 'green' }
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    filed: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? ''}`}>
      {status}
    </span>
  )
}

function taxTypeBadge(taxType: string) {
  const styles: Record<string, string> = {
    GST: 'bg-indigo-100 text-indigo-700',
    HST: 'bg-sky-100 text-sky-700',
    QST: 'bg-violet-100 text-violet-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[taxType] ?? 'bg-gray-100 text-gray-600'}`}>
      {taxType}
    </span>
  )
}

function urgencyIcon(urgency: Urgency) {
  switch (urgency) {
    case 'red': return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
    case 'yellow': return <ClockIcon className="h-4 w-4 text-amber-500" />
    case 'green': return <CheckCircleIcon className="h-4 w-4 text-green-500" />
  }
}

export default function IndirectTaxPage() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<IndirectTaxAccount[]>([])
  const [periods, setPeriods] = useState<IndirectTaxPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)

  useEffect(() => {
    fetch('/api/entities')
      .then((r) => r.json())
      .then((data: Entity[]) => {
        setEntities(data)
        if (data.length > 0) setSelectedEntityId(data[0]!.id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedEntityId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: show spinner immediately before async fetch
    setDataLoading(true)

    Promise.all([
      fetch(`/api/finance/indirect-tax/accounts?entityId=${selectedEntityId}`).then((r) => r.json()),
      fetch(`/api/finance/indirect-tax/periods?entityId=${selectedEntityId}`).then((r) => r.json()),
    ])
      .then(([accts, prds]) => {
        setAccounts(accts)
        setPeriods(prds)
      })
      .catch(() => {})
      .finally(() => setDataLoading(false))
  }, [selectedEntityId])

  // Group periods by account
  const periodsByAccount = accounts.map((acct) => ({
    account: acct,
    periods: periods
      .filter((p) => p.accountId === acct.id)
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()),
  }))

  // Compute open period deadlines for overview
  const openDeadlines = periods
    .filter((p) => p.status === 'open')
    .map((p) => {
      const filing = computeUrgency(p.filingDue)
      return { ...p, ...filing }
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business" className="hover:underline">Business OS</Link>
          {' / '}
          <Link href="/business/finance" className="hover:underline">Finance</Link>
          {' / Indirect Tax'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Indirect Tax (GST/HST/QST)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Filing period tracking, ITC reconciliation, and remittance deadlines.
        </p>
      </div>

      {/* Entity selector */}
      {entities.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
          <select
            value={selectedEntityId ?? ''}
            onChange={(e) => setSelectedEntityId(e.target.value)}
            className="w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {entities.map((e) => (
              <option key={e.id} value={e.id}>{e.legalName}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <div className="space-y-8">
          {/* Open Deadlines Overview */}
          {openDeadlines.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Open Filing Deadlines
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {openDeadlines.slice(0, 6).map((d) => (
                  <div
                    key={d.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      d.urgency === 'red' ? 'bg-red-50 border-red-200 text-red-600' :
                      d.urgency === 'yellow' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                      'bg-green-50 border-green-200 text-green-600'
                    }`}
                  >
                    {urgencyIcon(d.urgency)}
                    <div>
                      <p className="text-sm font-medium">{d.taxType} — {d.startDate} to {d.endDate}</p>
                      <p className="text-xs mt-0.5">
                        Filing due: {new Date(d.filingDue).toLocaleDateString('en-CA')}
                        {d.daysRemaining < 0
                          ? ` · ${Math.abs(d.daysRemaining)}d overdue`
                          : ` · ${d.daysRemaining}d remaining`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accounts + Periods */}
          {dataLoading ? (
            <p className="text-gray-400 text-sm">Loading indirect tax data...</p>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white border border-gray-200 rounded-lg">
              <ReceiptPercentIcon className="h-12 w-12 mx-auto mb-3" />
              <p className="font-medium">No indirect tax accounts registered</p>
              <p className="text-xs mt-1">Register your GST/HST and QST accounts to start tracking filing periods.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {periodsByAccount.map(({ account, periods: acctPeriods }) => (
                <div key={account.id} className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-center gap-3 mb-4">
                    {taxTypeBadge(account.taxType)}
                    <h3 className="text-sm font-semibold text-gray-700">
                      {account.taxType} — {account.filingFrequency}
                    </h3>
                    {account.programAccountNumber && (
                      <span className="text-xs text-gray-400 font-mono">
                        #{account.programAccountNumber}
                      </span>
                    )}
                  </div>

                  {acctPeriods.length === 0 ? (
                    <p className="text-sm text-gray-400">No periods created yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                            <th className="pb-2">Period</th>
                            <th className="pb-2">Filing Due</th>
                            <th className="pb-2">Payment Due</th>
                            <th className="pb-2">Status</th>
                            <th className="pb-2">Urgency</th>
                          </tr>
                        </thead>
                        <tbody>
                          {acctPeriods.map((p) => {
                            const dl = p.status === 'open' ? computeUrgency(p.filingDue) : null
                            return (
                              <tr key={p.id} className="border-b border-gray-50">
                                <td className="py-2 font-medium">{p.startDate} → {p.endDate}</td>
                                <td className="py-2">{new Date(p.filingDue).toLocaleDateString('en-CA')}</td>
                                <td className="py-2">{new Date(p.paymentDue).toLocaleDateString('en-CA')}</td>
                                <td className="py-2">{statusBadge(p.status)}</td>
                                <td className="py-2">
                                  {dl ? (
                                    <div className="flex items-center gap-1">
                                      {urgencyIcon(dl.urgency)}
                                      <span className="text-xs text-gray-500">
                                        {dl.daysRemaining < 0
                                          ? `${Math.abs(dl.daysRemaining)}d overdue`
                                          : `${dl.daysRemaining}d`}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
