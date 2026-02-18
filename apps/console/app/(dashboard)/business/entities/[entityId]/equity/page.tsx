'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface ShareClass {
  id: string
  code: string
  displayName: string
  votesPerShare: string
  isConvertible: boolean
  transferRestricted: boolean
}

interface LedgerEntry {
  id: string
  entryType: string
  classId: string
  quantity: string
  pricePerShare: string | null
  effectiveDate: string
  notes: string | null
  hash: string
  createdAt: string
}

export default function EquityPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const [classes, setClasses] = useState<ShareClass[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [tab, setTab] = useState<'classes' | 'ledger'>('classes')

  useEffect(() => {
    fetch(`/api/entities/${entityId}/equity/share-classes`)
      .then((r) => r.json())
      .then(setClasses)
      .catch(() => {})
    fetch(`/api/entities/${entityId}/equity/ledger`)
      .then((r) => r.json())
      .then(setLedger)
      .catch(() => {})
  }, [entityId])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business/entities" className="hover:underline">Entities</Link>
          {' / '}
          <Link href={`/business/entities/${entityId}`} className="hover:underline">Entity</Link>
          {' / Equity'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Equity & Cap Table</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        {(['classes', 'ledger'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium capitalize ${
              tab === t ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'
            }`}
          >
            {t === 'classes' ? `Share Classes (${classes.length})` : `Ledger (${ledger.length})`}
          </button>
        ))}
      </div>

      {tab === 'classes' && (
        <div className="space-y-3">
          {classes.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No share classes defined.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Display Name</th>
                    <th className="pb-2">Votes/Share</th>
                    <th className="pb-2">Convertible</th>
                    <th className="pb-2">Transfer Restricted</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="py-2 font-mono text-xs">{c.code}</td>
                      <td className="py-2">{c.displayName}</td>
                      <td className="py-2">{c.votesPerShare}</td>
                      <td className="py-2">{c.isConvertible ? 'Yes' : 'No'}</td>
                      <td className="py-2">{c.transferRestricted ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'ledger' && (
        <div className="space-y-3">
          {ledger.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No ledger entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Quantity</th>
                    <th className="pb-2">Price</th>
                    <th className="pb-2">Effective Date</th>
                    <th className="pb-2">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id} className="border-b border-gray-100">
                      <td className="py-2">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                          {e.entryType}
                        </span>
                      </td>
                      <td className="py-2 font-mono">{e.quantity}</td>
                      <td className="py-2">{e.pricePerShare ?? '—'}</td>
                      <td className="py-2">{e.effectiveDate}</td>
                      <td className="py-2 font-mono text-xs text-gray-400" title={e.hash}>
                        {e.hash.slice(0, 12)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
