'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  SparklesIcon,
  UserIcon,
  DocumentTextIcon,
  CubeIcon,
  CalculatorIcon,
} from '@heroicons/react/24/outline'
import { createQuoteAction } from '@/lib/actions'
import { ZohoProductSearch } from './zoho-product-search'
import { ThemeSmartPicker } from './theme-smart-picker'
import { AIQuoteAssistant } from './ai-quote-assistant'

interface LineItem {
  id: string
  description: string
  sku: string
  quantity: number
  unitCost: number
}

const GST_RATE = 0.05
const QST_RATE = 0.09975

const TIERS = [
  { value: 'BUDGET' as const, label: 'Budget', desc: 'Cost-effective essentials', accent: 'border-gray-300 hover:border-gray-400' },
  { value: 'STANDARD' as const, label: 'Standard', desc: 'Popular curated selection', accent: 'border-electric/40 hover:border-electric' },
  { value: 'PREMIUM' as const, label: 'Premium', desc: 'Luxury artisan products', accent: 'border-amber-300 hover:border-amber-400' },
]

const SECTIONS = [
  { icon: UserIcon, label: 'Client' },
  { icon: DocumentTextIcon, label: 'Details' },
  { icon: CubeIcon, label: 'Items' },
  { icon: CalculatorIcon, label: 'Summary' },
]

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function NewQuotePage() {
  const router = useRouter()
  const locale = useLocale()
  const base = `/${locale}/dashboard`
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

  // Progress tracking
  const filledSections = [
    clientName.length > 0,
    title.length > 0,
    lines.some((l) => l.description.length > 0),
    true,
  ]
  const progress = filledSections.filter(Boolean).length

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

  // AI: apply smart pricing suggestions as line items
  function handleApplyPricing(suggestions: Array<{ sku: string; description: string; suggestedPrice: number }>) {
    const newLines = suggestions.map((s) => ({
      id: generateId(),
      description: s.description,
      sku: s.sku,
      quantity: boxCount,
      unitCost: s.suggestedPrice,
    }))
    setLines(newLines)
  }

  // AI: apply RFP extraction to form fields
  function handleApplyRfp(extraction: {
    clientName: string | null
    clientEmail: string | null
    items: Array<{ description: string; quantity: number }>
    budget: number | null
    notes: string | null
  }) {
    if (extraction.clientName) setClientName(extraction.clientName)
    if (extraction.clientEmail) setClientEmail(extraction.clientEmail)
    if (extraction.notes) setNotes(extraction.notes)
    if (extraction.items.length > 0) {
      setLines(
        extraction.items.map((item) => ({
          id: generateId(),
          description: item.description,
          sku: '',
          quantity: item.quantity,
          unitCost: 0,
        })),
      )
    }
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
        router.push(`${base}/quotes/${result.data.id}`)
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
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Back */}
      <Link
        href={`${base}/quotes`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy transition-colors mb-6"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Quotes
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy">New Quote</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create a tiered gift box proposal with automatic Quebec tax calculation.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="hidden lg:flex items-center gap-1">
          {SECTIONS.map((s, i) => (
            <div key={s.label} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filledSections[i]
                  ? 'bg-electric/10 text-electric'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </div>
              {i < SECTIONS.length - 1 && (
                <div className={`w-6 h-px mx-1 ${filledSections[i] ? 'bg-electric/30' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main form (2/3 width) ────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* ── Client ───────────────────────────────────────── */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="rounded-lg bg-electric/5 p-1.5">
                  <UserIcon className="h-4 w-4 text-electric" />
                </div>
                <h2 className="text-base font-semibold text-navy">Client</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Company / Name</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                    placeholder="Desjardins Assurances"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                    placeholder="achats@desjardins.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                    placeholder="514-555-0100"
                  />
                </div>
              </div>
            </section>

            {/* ── Quote Details ─────────────────────────────────── */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="rounded-lg bg-electric/5 p-1.5">
                  <DocumentTextIcon className="h-4 w-4 text-electric" />
                </div>
                <h2 className="text-base font-semibold text-navy">Quote Details</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                    placeholder="Holiday Gift Boxes 2026"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Box Count</label>
                  <input
                    type="number"
                    min={1}
                    value={boxCount}
                    onChange={(e) => setBoxCount(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                  />
                </div>
                <div>
                  <ThemeSmartPicker value={theme} onChange={setTheme} tier={tier} />
                </div>
              </div>

              {/* Tier selector */}
              <label className="block text-sm font-medium text-gray-700 mb-2">Pricing Tier</label>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {TIERS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTier(t.value)}
                    className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                      tier === t.value
                        ? 'border-electric bg-electric/5 shadow-sm'
                        : `border-gray-200 bg-white ${t.accent}`
                    }`}
                  >
                    {tier === t.value && (
                      <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-electric" />
                    )}
                    <p className={`text-sm font-semibold ${tier === t.value ? 'text-electric' : 'text-navy'}`}>
                      {t.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition resize-none"
                  placeholder="Additional instructions, delivery preferences..."
                />
              </div>
            </section>

            {/* ── Line Items ───────────────────────────────────── */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-electric/5 p-1.5">
                    <CubeIcon className="h-4 w-4 text-electric" />
                  </div>
                  <h2 className="text-base font-semibold text-navy">Line Items</h2>
                  <span className="text-xs text-gray-400 ml-1">{lines.length} item{lines.length !== 1 ? 's' : ''}</span>
                </div>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-electric bg-electric/5 rounded-lg hover:bg-electric/10 transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Item
                </button>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-12 gap-3 px-3 mb-2">
                <div className="col-span-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Product</div>
                <div className="col-span-2 text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</div>
                <div className="col-span-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</div>
                <div className="col-span-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</div>
                <div className="col-span-1" />
              </div>

              <div className="space-y-2">
                {lines.map((line) => (
                  <div
                    key={line.id}
                    className="grid grid-cols-12 gap-3 items-center bg-gray-50/60 rounded-lg p-3 group hover:bg-gray-50 transition-colors"
                  >
                    <div className="col-span-4">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                          placeholder="Gift box item..."
                          className="flex-1 px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                        />
                        <ZohoProductSearch
                          currentDescription={line.description}
                          onSelect={(product) => {
                            updateLine(line.id, 'description', product.description)
                            updateLine(line.id, 'sku', product.sku)
                            updateLine(line.id, 'unitCost', product.unitCost)
                          }}
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={line.sku}
                        onChange={(e) => updateLine(line.id, 'sku', e.target.value)}
                        placeholder="SKU-001"
                        className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white font-mono focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, 'quantity', Number(e.target.value))}
                        className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white tabular-nums focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                      />
                    </div>
                    <div className="col-span-3">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.unitCost}
                          onChange={(e) => updateLine(line.id, 'unitCost', Number(e.target.value))}
                          className="w-full pl-7 pr-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white tabular-nums focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                        />
                      </div>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length === 1}
                        className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-red-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ── Sticky sidebar (1/3 width) ───────────────────── */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-8 space-y-6">
              {/* Summary */}
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="rounded-lg bg-electric/5 p-1.5">
                    <CalculatorIcon className="h-4 w-4 text-electric" />
                  </div>
                  <h2 className="text-base font-semibold text-navy">Summary</h2>
                </div>

                <dl className="space-y-3">
                  {title && (
                    <div>
                      <dt className="text-xs text-gray-500">Title</dt>
                      <dd className="text-sm font-medium text-navy truncate">{title}</dd>
                    </div>
                  )}
                  {clientName && (
                    <div>
                      <dt className="text-xs text-gray-500">Client</dt>
                      <dd className="text-sm font-medium text-navy truncate">{clientName}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-xs text-gray-500">Tier</dt>
                    <dd className="text-sm font-medium text-navy">{tier.charAt(0) + tier.slice(1).toLowerCase()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-xs text-gray-500">Boxes</dt>
                    <dd className="text-sm font-medium text-navy">{boxCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-xs text-gray-500">Line items</dt>
                    <dd className="text-sm font-medium text-navy">{lines.length}</dd>
                  </div>
                </dl>

                <div className="border-t border-gray-100 mt-4 pt-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>GST (5%)</span>
                    <span className="font-mono tabular-nums">{formatCurrency(gst)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>QST (9.975%)</span>
                    <span className="font-mono tabular-nums">{formatCurrency(qst)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-navy">
                    <span>Total</span>
                    <span className="font-mono tabular-nums">{formatCurrency(total)}</span>
                  </div>
                </div>
              </section>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-electric text-white text-sm font-semibold rounded-xl hover:bg-electric-light transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SparklesIcon className="h-4 w-4" />
                  {submitting ? 'Creating...' : 'Create Quote'}
                </button>
                <Link
                  href={`${base}/quotes`}
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </Link>
              </div>

              {/* AI Assistant */}
              <AIQuoteAssistant
                tier={tier}
                boxCount={boxCount}
                theme={theme}
                onApplyPricing={handleApplyPricing}
                onApplyRfp={handleApplyRfp}
              />

              {/* Completion hint */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-electric rounded-full transition-all duration-300"
                      style={{ width: `${(progress / SECTIONS.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 tabular-nums">{progress}/{SECTIONS.length}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {progress < SECTIONS.length
                    ? 'Fill in all sections to complete your quote.'
                    : 'All sections complete. Ready to create!'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
