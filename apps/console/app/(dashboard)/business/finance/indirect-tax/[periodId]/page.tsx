'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CalculatorIcon,
} from '@heroicons/react/24/outline'

interface PeriodDetail {
  period: {
    id: string
    entityId: string
    accountId: string
    taxType: string
    startDate: string
    endDate: string
    filingDue: string
    paymentDue: string
    status: string
    documentId: string | null
    sha256: string | null
  }
  summary: {
    id: string
    totalSales: string | null
    taxCollected: string | null
    itcs: string | null
    netPayable: string | null
    reconciled: boolean
  } | null
  account: {
    taxType: string
    filingFrequency: string
    programAccountNumber: string | null
  } | null
  deadlines: Array<{
    label: string
    dueDate: string
    daysRemaining: number
    urgency: 'green' | 'yellow' | 'red'
    type: string
  }>
}

function urgencyIcon(u: 'green' | 'yellow' | 'red') {
  switch (u) {
    case 'red': return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
    case 'yellow': return <ClockIcon className="h-4 w-4 text-amber-500" />
    case 'green': return <CheckCircleIcon className="h-4 w-4 text-green-500" />
  }
}

export default function IndirectTaxPeriodDetailPage({
  params,
}: {
  params: Promise<{ periodId: string }>
}) {
  const { periodId } = use(params)
  const [data, setData] = useState<PeriodDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/finance/indirect-tax/periods/${periodId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [periodId])

  if (loading) {
    return <div className="p-8"><p className="text-gray-400 text-sm">Loading period...</p></div>
  }
  if (!data) {
    return <div className="p-8"><p className="text-red-500">Period not found.</p></div>
  }

  const { period, summary, account, deadlines } = data
  const statusStyles: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    filed: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
  }

  function fmt(v: string | null) {
    return v ? `$${Number(v).toLocaleString('en-CA', { minimumFractionDigits: 2 })}` : '—'
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business" className="hover:underline">Business OS</Link>
          {' / '}
          <Link href="/business/finance" className="hover:underline">Finance</Link>
          {' / '}
          <Link href="/business/finance/indirect-tax" className="hover:underline">Indirect Tax</Link>
          {` / ${period.taxType} Period`}
        </p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {period.taxType} — {period.startDate} to {period.endDate}
          </h1>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[period.status] ?? ''}`}>
            {period.status}
          </span>
        </div>
        {account && (
          <p className="text-sm text-gray-500 mt-1">
            {account.filingFrequency} filing
            {account.programAccountNumber ? ` · Account #${account.programAccountNumber}` : ''}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Deadlines + Filing Info */}
        <div className="space-y-6">
          {/* Deadlines */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Deadlines</h2>
            <div className="space-y-2">
              {deadlines.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {urgencyIcon(d.urgency)}
                  <div>
                    <span className="font-medium">{d.label}</span>
                    <span className="text-gray-500 ml-1">
                      {new Date(d.dueDate).toLocaleDateString('en-CA')}
                      {d.daysRemaining < 0
                        ? ` (${Math.abs(d.daysRemaining)}d overdue)`
                        : ` (${d.daysRemaining}d)`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Filing Evidence</h2>
            {period.documentId ? (
              <div className="text-sm space-y-1">
                <p><span className="text-gray-500">Document ID:</span> <span className="font-mono text-xs">{period.documentId}</span></p>
                {period.sha256 && (
                  <p><span className="text-gray-500">SHA-256:</span> <span className="font-mono text-xs">{period.sha256.slice(0, 24)}…</span></p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No filing evidence uploaded yet.</p>
            )}
          </div>
        </div>

        {/* Right: ITC Reconciliation Summary */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalculatorIcon className="h-5 w-5 text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">ITC Reconciliation</h2>
          </div>

          {summary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Total Sales</p>
                  <p className="text-lg font-semibold text-gray-900">{fmt(summary.totalSales)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Tax Collected</p>
                  <p className="text-lg font-semibold text-gray-900">{fmt(summary.taxCollected)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Input Tax Credits</p>
                  <p className="text-lg font-semibold text-gray-900">{fmt(summary.itcs)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Net Payable</p>
                  <p className={`text-lg font-semibold ${
                    summary.netPayable && Number(summary.netPayable) > 0
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}>
                    {fmt(summary.netPayable)}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  {summary.reconciled ? (
                    <>
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-700 font-medium">Reconciled</span>
                    </>
                  ) : (
                    <>
                      <ClockIcon className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-amber-700 font-medium">Not Reconciled</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <CalculatorIcon className="h-10 w-10 mx-auto mb-2" />
              <p className="text-sm">No ITC summary recorded for this period.</p>
              <p className="text-xs mt-1">Add reconciliation figures to track GST/HST/QST obligations.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
