'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BuildingOffice2Icon,
  PlusIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

interface Entity {
  id: string
  legalName: string
  jurisdiction: string
  incorporationNumber: string | null
  fiscalYearEnd: string | null
  status: string
  createdAt: string
}

export default function EntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ legalName: '', jurisdiction: 'CA-ON', incorporationNumber: '', fiscalYearEnd: '12-31' })

  // Fetch on mount
  useEffect(() => {
    fetch('/api/entities')
      .then((r) => r.json())
      .then((data) => { setEntities(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const entity = await res.json()
      setEntities((prev) => [...prev, entity])
      setShowCreate(false)
      setForm({ legalName: '', jurisdiction: 'CA-ON', incorporationNumber: '', fiscalYearEnd: '12-31' })
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entities</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your corporate entities</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <PlusIcon className="h-4 w-4" /> Add Entity
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-6 mb-8 space-y-4">
          <h2 className="font-semibold text-gray-900">New Entity</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name</label>
              <input
                type="text"
                required
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jurisdiction</label>
              <input
                type="text"
                required
                value={form.jurisdiction}
                onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g. CA-ON"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Incorporation Number</label>
              <input
                type="text"
                value={form.incorporationNumber}
                onChange={(e) => setForm({ ...form, incorporationNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year End (MM-DD)</label>
              <input
                type="text"
                value={form.fiscalYearEnd}
                onChange={(e) => setForm({ ...form, fiscalYearEnd: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="12-31"
              />
            </div>
          </div>
          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
            Create Entity
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : entities.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BuildingOffice2Icon className="h-12 w-12 mx-auto mb-4" />
          <p>No entities yet. Create your first corporation above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entities.map((entity) => (
            <Link
              key={entity.id}
              href={`/business/entities/${entity.id}`}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition"
            >
              <div className="flex items-center gap-4">
                <BuildingOffice2Icon className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium text-gray-900">{entity.legalName}</p>
                  <p className="text-xs text-gray-500">
                    {entity.jurisdiction} · {entity.incorporationNumber ?? 'No reg. #'} · FYE {entity.fiscalYearEnd ?? 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded-full ${entity.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {entity.status}
                </span>
                <ArrowRightIcon className="h-4 w-4 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
