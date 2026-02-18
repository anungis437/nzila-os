'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PlusIcon } from '@heroicons/react/24/outline'

interface Entity {
  id: string
  legalName: string
}

interface ShareClass {
  id: string
  code: string
  displayName: string
}

export default function IssueSharesPage() {
  const router = useRouter()
  const [entities, setEntities] = useState<Entity[]>([])
  const [shareClasses, setShareClasses] = useState<ShareClass[]>([])
  const [selectedEntity, setSelectedEntity] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    classId: '',
    quantity: '',
    pricePerShare: '',
    recipientName: '',
    notes: '',
  })

  useEffect(() => {
    fetch('/api/entities')
      .then((r) => r.json())
      .then(setEntities)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Load share classes when entity changes
  useEffect(() => {
    if (!selectedEntity) return
    fetch(`/api/entities/${selectedEntity}/equity/share-classes`)
      .then((r) => r.json())
      .then(setShareClasses)
      .catch(() => {})
  }, [selectedEntity])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selectedEntity) {
      setError('Please select an entity')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/entities/${selectedEntity}/equity/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryType: 'issuance',
          classId: form.classId,
          quantity: form.quantity,
          pricePerShare: form.pricePerShare || undefined,
          effectiveDate: new Date().toISOString().slice(0, 10),
          notes: form.notes || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to issue shares')
      }
      router.push(`/business/entities/${selectedEntity}/equity`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to issue shares')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business" className="hover:underline">Business OS</Link>
          {' / '}
          <Link href="/business/equity" className="hover:underline">EquityOS</Link>
          {' / Issue Shares'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Issue Shares</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a new share issuance entry in the ledger.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 bg-white border border-gray-200 rounded-xl p-6">
        {/* Entity Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
          {loading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : (
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            >
              <option value="">Select entity</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.legalName}</option>
              ))}
            </select>
          )}
        </div>

        {/* Share Class */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Share Class</label>
          <select
            value={form.classId}
            onChange={(e) => setForm({ ...form, classId: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            required
            disabled={!selectedEntity}
          >
            <option value="">Select share class</option>
            {shareClasses.map((sc) => (
              <option key={sc.id} value={sc.id}>{sc.displayName} ({sc.code})</option>
            ))}
          </select>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input
            type="number"
            min="1"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Number of shares"
            required
          />
        </div>

        {/* Price Per Share */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price Per Share (optional)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.pricePerShare}
            onChange={(e) => setForm({ ...form, pricePerShare: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="0.00"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            rows={3}
            placeholder="Optional notes about this issuance"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !selectedEntity}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <PlusIcon className="h-4 w-4" />
          {submitting ? 'Issuing...' : 'Issue Shares'}
        </button>
      </form>
    </div>
  )
}
