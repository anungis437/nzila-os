'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { createQuoteAction } from '@/lib/actions'

interface LineItem {
  id: string
  description: string
  sku: string
  quantity: number
  unitCost: number
}

const GST_RATE = 0.05
const QST_RATE = 0.09975

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function NewQuotePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  // Client fields
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')

  // Quote fields
  const [title, setTitle] = useState('')
  const [tier, setTier] = useState<'BUDGET' | 'STANDARD' | 'PREMIUM'>('STANDARD')
  const [notes, setNotes] = useState('')
  const [boxCount, setBoxCount] = useState(1)
  const [theme, setTheme] = useState('')

  // Line items
  const [lines, setLines] = useState<LineItem[]>([
    { id: generateId(), description: '', sku: '', quantity: 1, unitCost: 0 },
  ])

  // Derived totals
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0)
  const gst = subtotal * GST_RATE
  const qst = (subtotal + gst) * QST_RATE
  const total = subtotal + gst + qst

  function addLine() {
    setLines((prev) => [
      ...prev,
      { id: generateId(), description: '', sku: '', quantity: 1, unitCost: 0 },
    ])
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  function updateLine(id: string, field: keyof LineItem, value: string | number) {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)),
    )
  }

  function formatCurrency(n: number) {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const result = await createQuoteAction({
        clientName,
        clientEmail,
        clientPhone,
        title,
        tier,
        boxCount,
        theme,
        notes,
        lines,
      })
      if (result.ok && result.data) {
        router.push(`/quotes/${result.data.id}`)
      } else {
        alert(result.error ?? 'Failed to create quote')
      }
    } catch {
      alert('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href="/quotes"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Quotes
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">New Quote</h1>
      <p className="text-sm text-gray-500 mb-8">
        Create a tiered gift box proposal with automatic Quebec tax calculation.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── Client ─────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Client</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company / Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Desjardins Assurances"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="achats@desjardins.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="514-555-0100"
              />
            </div>
          </div>
        </section>

        {/* ── Quote Details ──────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quote Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Holiday Gift Boxes 2026"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pricing Tier</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as 'BUDGET' | 'STANDARD' | 'PREMIUM')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="BUDGET">Budget</option>
                <option value="STANDARD">Standard</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Box Count</label>
              <input
                type="number"
                min={1}
                value={boxCount}
                onChange={(e) => setBoxCount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Theme</label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Holiday, Corporate, Wellness..."
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              placeholder="Additional instructions, delivery preferences..."
            />
          </div>
        </section>

        {/* ── Line Items ─────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
            >
              <PlusIcon className="h-4 w-4" />
              Add Item
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div
                key={line.id}
                className="grid grid-cols-12 gap-3 items-end bg-gray-50 rounded-lg p-3"
              >
                <div className="col-span-4">
                  {idx === 0 && (
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Product / Description
                    </label>
                  )}
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                    placeholder="Gift box item..."
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && (
                    <label className="block text-xs font-medium text-gray-500 mb-1">SKU</label>
                  )}
                  <input
                    type="text"
                    value={line.sku}
                    onChange={(e) => updateLine(line.id, 'sku', e.target.value)}
                    placeholder="SKU-001"
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && (
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                  )}
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(line.id, 'quantity', Number(e.target.value))}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div className="col-span-3">
                  {idx === 0 && (
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Unit Cost ($)
                    </label>
                  )}
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={line.unitCost}
                    onChange={(e) => updateLine(line.id, 'unitCost', Number(e.target.value))}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    disabled={lines.length === 1}
                    className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Totals ─────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
          <div className="space-y-2 max-w-xs ml-auto">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>GST (5%)</span>
              <span className="font-mono">{formatCurrency(gst)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>QST (9.975%)</span>
              <span className="font-mono">{formatCurrency(qst)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between text-base font-bold text-gray-900">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(total)}</span>
            </div>
          </div>
        </section>

        {/* ── Actions ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/quotes"
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SparklesIcon className="h-4 w-4" />
            {submitting ? 'Creating...' : 'Create Quote'}
          </button>
        </div>
      </form>
    </div>
  )
}
