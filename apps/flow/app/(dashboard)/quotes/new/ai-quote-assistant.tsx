'use client'

/**
 * AI Quote Assistant — Smart pricing, RFP extraction, and product suggestions.
 *
 * Provides:
 *   1. Smart Pricing — AI-generated line item suggestions based on tier, box count, theme
 *   2. Import from RFP — Paste email/document text and auto-populate quote fields
 *   3. Similar Products — Find related products from a description
 */
import { useState } from 'react'
import {
  SparklesIcon,
  DocumentArrowUpIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

interface PricingSuggestion {
  sku: string
  description: string
  suggestedPrice: number
  confidence: number
  reasoning: string
}

interface RfpExtraction {
  clientName: string | null
  clientEmail: string | null
  items: Array<{ description: string; quantity: number }>
  budget: number | null
  deadline: string | null
  notes: string | null
}

interface SimilarProduct {
  sku: string
  name: string
  similarity: number
}

interface AIQuoteAssistantProps {
  tier: string
  boxCount: number
  theme: string
  onApplyPricing: (suggestions: PricingSuggestion[]) => void
  onApplyRfp: (extraction: RfpExtraction) => void
  onAddProduct?: (product: SimilarProduct) => void
}

type Tab = 'pricing' | 'rfp' | 'similar'

export function AIQuoteAssistant({
  tier,
  boxCount,
  theme,
  onApplyPricing,
  onApplyRfp,
  onAddProduct,
}: AIQuoteAssistantProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('pricing')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Smart Pricing state
  const [suggestions, setSuggestions] = useState<PricingSuggestion[]>([])

  // RFP state
  const [rfpText, setRfpText] = useState('')
  const [extraction, setExtraction] = useState<RfpExtraction | null>(null)

  // Similar Products state
  const [searchDesc, setSearchDesc] = useState('')
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([])

  async function handleSmartPricing() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/quotes/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'smart-pricing', tier, boxCount, theme }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSuggestions(data.suggestions ?? [])
      }
    } catch {
      setError('Failed to get AI suggestions')
    } finally {
      setLoading(false)
    }
  }

  async function handleSimilarSearch() {
    if (!searchDesc.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/quotes/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'similar-products', description: searchDesc, limit: 5 }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSimilarProducts(data.products ?? [])
      }
    } catch {
      setError('Failed to find similar products')
    } finally {
      setLoading(false)
    }
  }

  async function handleExtractRfp() {
    if (!rfpText.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/quotes/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract-rfp', rfpText }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setExtraction(data.extraction)
      }
    } catch {
      setError('Failed to extract RFP')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-electric bg-electric/5 rounded-lg hover:bg-electric/10 transition-colors border border-electric/10"
      >
        <SparklesIcon className="h-4 w-4" />
        AI Assistant
      </button>
    )
  }

  return (
    <div className="bg-gradient-to-br from-electric/[0.03] to-violet-50/30 rounded-xl border border-electric/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-electric/10">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-electric/10 p-1.5">
            <SparklesIcon className="h-4 w-4 text-electric" />
          </div>
          <h3 className="text-sm font-semibold text-navy">AI Quote Assistant</h3>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-electric/10">
        <button
          type="button"
          onClick={() => setTab('pricing')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
            tab === 'pricing'
              ? 'text-electric border-b-2 border-electric bg-white/50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <LightBulbIcon className="h-3.5 w-3.5" />
          Smart Pricing
        </button>
        <button
          type="button"
          onClick={() => setTab('rfp')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
            tab === 'rfp'
              ? 'text-electric border-b-2 border-electric bg-white/50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <DocumentArrowUpIcon className="h-3.5 w-3.5" />
          Import from RFP
        </button>
        <button
          type="button"
          onClick={() => setTab('similar')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
            tab === 'similar'
              ? 'text-electric border-b-2 border-electric bg-white/50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MagnifyingGlassIcon className="h-3.5 w-3.5" />
          Similar Products
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {error && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            {error}
          </div>
        )}

        {/* ── Smart Pricing ──────────────────────────────────── */}
        {tab === 'pricing' && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              Get AI-powered line item suggestions based on the current tier ({tier}), box count ({boxCount}), and theme.
            </p>

            <button
              type="button"
              onClick={handleSmartPricing}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-electric rounded-lg hover:bg-electric/90 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <SparklesIcon className="h-4 w-4" />
                  Generate Suggestions
                </>
              )}
            </button>

            {suggestions.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-navy">{suggestions.length} suggestions</p>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyPricing(suggestions)
                      setOpen(false)
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition"
                  >
                    <CheckIcon className="h-3 w-3" />
                    Apply All
                  </button>
                </div>

                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg border border-gray-100 p-3 text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-navy">{s.description}</p>
                        <p className="text-gray-400 font-mono mt-0.5">{s.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-navy font-mono">${s.suggestedPrice.toFixed(2)}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="h-1 w-12 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-electric rounded-full"
                              style={{ width: `${s.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-gray-400">{Math.round(s.confidence * 100)}%</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-500 mt-1.5 leading-relaxed">{s.reasoning}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── RFP Import ─────────────────────────────────────── */}
        {tab === 'rfp' && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              Paste an RFP email or document and the AI will extract client info, items, budget, and deadline automatically.
            </p>

            {!extraction ? (
              <>
                <textarea
                  value={rfpText}
                  onChange={(e) => setRfpText(e.target.value)}
                  rows={5}
                  placeholder="Paste RFP text here...&#10;&#10;e.g. &quot;Hi, we'd like 200 holiday gift boxes for our team. Budget is around $15,000. Contact: Jane Smith, jane@acme.com&quot;"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition resize-none mb-3"
                />
                <button
                  type="button"
                  onClick={handleExtractRfp}
                  disabled={loading || !rfpText.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-electric rounded-lg hover:bg-electric/90 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <DocumentArrowUpIcon className="h-4 w-4" />
                      Extract Fields
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="bg-white rounded-lg border border-gray-100 p-3">
                  <p className="text-xs font-medium text-navy mb-2">Extracted Fields</p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    {extraction.clientName && (
                      <div>
                        <dt className="text-gray-400">Client</dt>
                        <dd className="font-medium text-navy">{extraction.clientName}</dd>
                      </div>
                    )}
                    {extraction.clientEmail && (
                      <div>
                        <dt className="text-gray-400">Email</dt>
                        <dd className="font-medium text-navy">{extraction.clientEmail}</dd>
                      </div>
                    )}
                    {extraction.budget != null && (
                      <div>
                        <dt className="text-gray-400">Budget</dt>
                        <dd className="font-medium text-navy">${extraction.budget.toLocaleString()}</dd>
                      </div>
                    )}
                    {extraction.deadline && (
                      <div>
                        <dt className="text-gray-400">Deadline</dt>
                        <dd className="font-medium text-navy">{extraction.deadline}</dd>
                      </div>
                    )}
                  </dl>
                  {extraction.items.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-50">
                      <p className="text-gray-400 mb-1">Items ({extraction.items.length})</p>
                      {extraction.items.map((item, i) => (
                        <p key={i} className="text-navy">
                          {item.quantity}x {item.description}
                        </p>
                      ))}
                    </div>
                  )}
                  {extraction.notes && (
                    <p className="text-gray-500 mt-2 pt-2 border-t border-gray-50 italic">
                      {extraction.notes}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onApplyRfp(extraction)
                      setOpen(false)
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                    Apply to Quote
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExtraction(null)
                      setRfpText('')
                    }}
                    className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Similar Products ───────────────────────────────── */}
        {tab === 'similar' && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              Describe a product and the AI will find similar items from the catalog.
            </p>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={searchDesc}
                onChange={(e) => setSearchDesc(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSimilarSearch() }}
                placeholder="e.g. luxury wooden gift box with engraving"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
              />
              <button
                type="button"
                onClick={handleSimilarSearch}
                disabled={loading || !searchDesc.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-electric rounded-lg hover:bg-electric/90 transition disabled:opacity-50"
              >
                {loading ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <MagnifyingGlassIcon className="h-4 w-4" />
                )}
              </button>
            </div>

            {similarProducts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-navy">{similarProducts.length} matches</p>
                {similarProducts.map((p, i) => {
                  const pct = Math.round(p.similarity * 100)
                  const color = pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-gray-500'
                  return (
                    <div
                      key={i}
                      className="bg-white rounded-lg border border-gray-100 p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-medium text-navy">{p.name}</p>
                        <p className="text-gray-400 font-mono mt-0.5">{p.sku}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className={`font-semibold ${color}`}>{pct}%</span>
                          <div className="h-1 w-16 bg-gray-200 rounded-full overflow-hidden mt-0.5">
                            <div
                              className="h-full bg-electric rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        {onAddProduct && (
                          <button
                            type="button"
                            onClick={() => onAddProduct(p)}
                            className="p-1 text-electric hover:bg-electric/10 rounded transition"
                            title="Add to quote"
                          >
                            <CheckIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
