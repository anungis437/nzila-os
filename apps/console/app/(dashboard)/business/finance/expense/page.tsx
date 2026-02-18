'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BanknotesIcon } from '@heroicons/react/24/outline'

interface Entity {
  id: string
  legalName: string
  entityType: string
}

export default function ExpenseTrackingPage() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/entities')
      .then((r) => r.json())
      .then(setEntities)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business" className="hover:underline">Business OS</Link>
          {' / '}
          <Link href="/business/finance" className="hover:underline">Finance</Link>
          {' / Expenses'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Expense Tracking</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track and categorise entity expenses for compliance and reporting.
        </p>
      </div>

      {/* Coming Soon Banner */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-center gap-3">
          <BanknotesIcon className="h-6 w-6 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">Expense Module — Coming Soon</p>
            <p className="text-xs text-amber-600">
              Automated expense capture, receipt processing via Azure Blob, multi-currency support, and approval workflows.
            </p>
          </div>
        </div>
      </div>

      {/* Entity Quick Links */}
      <div>
        <h2 className="text-sm font-medium text-gray-700 mb-3">Your Entities</h2>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : entities.length === 0 ? (
          <div className="text-center py-10 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-500 text-sm">No entities yet.</p>
            <Link href="/business/entities" className="text-blue-600 text-sm hover:underline">
              Create your first entity →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {entities.map((entity) => (
              <Link
                key={entity.id}
                href={`/business/entities/${entity.id}`}
                className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition"
              >
                <p className="text-sm font-medium text-gray-900">{entity.legalName}</p>
                <p className="text-xs text-gray-500 capitalize mt-1">{entity.entityType}</p>
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-gray-400">Available now:</p>
                  <p className="text-xs text-blue-600">• Equity Ledger & Share Classes</p>
                  <p className="text-xs text-blue-600">• Governance Actions</p>
                  <p className="text-xs text-blue-600">• Audit Trail</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Feature Roadmap */}
      <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Expense Module Roadmap</h2>
        <div className="space-y-3">
          {[
            { label: 'Expense Categories & Budget Tracking', status: 'planned' },
            { label: 'Receipt Upload via Azure Blob Storage', status: 'planned' },
            { label: 'Multi-Currency Conversion', status: 'planned' },
            { label: 'Approval Workflow Integration', status: 'planned' },
            { label: 'XBRL / Tax Reporting Export', status: 'planned' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-gray-300" />
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className="ml-auto text-xs text-gray-400 capitalize">{item.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
