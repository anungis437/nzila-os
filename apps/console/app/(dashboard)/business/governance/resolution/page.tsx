'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DocumentTextIcon } from '@heroicons/react/24/outline'

interface Entity {
  id: string
  legalName: string
}

export default function CreateResolutionPage() {
  const router = useRouter()
  const [entities, setEntities] = useState<Entity[]>([])
  const [selectedEntity, setSelectedEntity] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    type: 'ordinary' as 'ordinary' | 'special' | 'written',
    body: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
  })

  useEffect(() => {
    fetch('/api/entities')
      .then((r) => r.json())
      .then(setEntities)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selectedEntity) {
      setError('Please select an entity')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/entities/${selectedEntity}/resolutions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          resolutionType: form.type,
          body: form.body,
          effectiveDate: form.effectiveDate,
          status: 'draft',
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create resolution')
      }
      router.push(`/business/entities/${selectedEntity}/governance`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create resolution')
    } finally {
      setSubmitting(false)
    }
  }

  const resolutionTypes = [
    { value: 'ordinary', label: 'Ordinary Resolution', desc: 'Simple majority (>50%)' },
    { value: 'special', label: 'Special Resolution', desc: 'Supermajority (≥75%)' },
    { value: 'written', label: 'Written Resolution', desc: 'Signed without meeting' },
  ]

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business" className="hover:underline">Business OS</Link>
          {' / '}
          <Link href="/business/governance" className="hover:underline">Governance</Link>
          {' / New Resolution'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Create Resolution</h1>
        <p className="text-sm text-gray-500 mt-1">
          Draft a new corporate resolution for board or shareholder approval.
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

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. Approval of Annual Financial Statements"
            required
          />
        </div>

        {/* Resolution Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Type</label>
          <div className="space-y-2">
            {resolutionTypes.map((rt) => (
              <label key={rt.value} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="resolutionType"
                  value={rt.value}
                  checked={form.type === rt.value}
                  onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{rt.label}</p>
                  <p className="text-xs text-gray-500">{rt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Effective Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
          <input
            type="date"
            value={form.effectiveDate}
            onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            required
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Body</label>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            rows={8}
            placeholder="BE IT RESOLVED THAT..."
            required
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !selectedEntity}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <DocumentTextIcon className="h-4 w-4" />
          {submitting ? 'Creating...' : 'Create Resolution'}
        </button>
      </form>
    </div>
  )
}
