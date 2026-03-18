'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  ArrowLeftIcon,
  SparklesIcon,
  CurrencyDollarIcon,
  CubeIcon,
  UserIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import {
  generateProposalsAction,
  type QuoteRequestFormData,
} from '@/app/actions/profitability'
import type { TieredProposal } from '@/lib/profitability'

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

function marginColor(pct: number) {
  if (pct >= 35) return 'text-emerald-600'
  if (pct >= 25) return 'text-amber-600'
  return 'text-red-600'
}

function marginBg(pct: number) {
  if (pct >= 35) return 'bg-emerald-50 border-emerald-200'
  if (pct >= 25) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

const tierAccent: Record<string, { border: string; bg: string; badge: string; ring: string }> = {
  BUDGET:   { border: 'border-gray-300', bg: 'bg-gray-50',    badge: 'bg-gray-100 text-gray-700',     ring: 'ring-gray-300' },
  STANDARD: { border: 'border-electric', bg: 'bg-electric/5', badge: 'bg-electric/10 text-electric',  ring: 'ring-electric/30' },
  PREMIUM:  { border: 'border-amber-400', bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700',   ring: 'ring-amber-300' },
}

const categories = [
  { value: '', label: 'All Categories' },
  { value: 'Signage', label: 'Signalisation' },
  { value: 'Shelving', label: 'Étagères & Rangement' },
  { value: 'Furniture', label: 'Mobilier' },
  { value: 'Racking', label: 'Systèmes de rayonnage' },
  { value: 'Equipment', label: 'Équipement industriel' },
]

export default function QuoteRequestPage() {
  const router = useRouter()
  const locale = useLocale()
  const base = `/${locale}/dashboard`

  const [step, setStep] = useState<'form' | 'proposals'>('form')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposals, setProposals] = useState<TieredProposal[]>([])
  const [formData, setFormData] = useState<QuoteRequestFormData>({
    clientName: '',
    clientEmail: '',
    clientCompany: '',
    budget: 5000,
    volume: 10,
    category: '',
    requirements: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsGenerating(true)
    setError(null)

    try {
      const result = await generateProposalsAction(formData)
      if (!result.ok) {
        setError(result.error ?? 'Failed to generate proposals')
        setIsGenerating(false)
        return
      }
      setProposals(result.proposals ?? [])
      setStep('proposals')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href={`${base}/quotes`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-electric transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Quotes
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-electric/10 p-3">
          <SparklesIcon className="h-6 w-6 text-electric" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-navy">Quote Request</h1>
          <p className="text-sm text-gray-500">
            Enter client requirements to generate 3 proposals with profitability analysis.
          </p>
        </div>
      </div>

      {step === 'form' ? (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Client Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserIcon className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-navy">Client Information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  required
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric/30 focus:border-electric"
                  placeholder="Jean Tremblay"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  required
                  value={formData.clientCompany}
                  onChange={(e) => setFormData({ ...formData, clientCompany: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric/30 focus:border-electric"
                  placeholder="Constructions ABC Inc."
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric/30 focus:border-electric"
                  placeholder="jean@constructionsabc.ca"
                />
              </div>
            </div>
          </div>

          {/* Project Requirements */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CubeIcon className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-navy">Project Requirements</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Budget
                  <span className="text-gray-400 font-normal ml-1">(CAD)</span>
                </label>
                <div className="relative">
                  <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    required
                    min={100}
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: parseInt(e.target.value) || 0 })}
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric/30 focus:border-electric"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Volume / Quantity</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={formData.volume}
                  onChange={(e) => setFormData({ ...formData, volume: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric/30 focus:border-electric"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-electric/30 focus:border-electric"
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special Requirements
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric/30 focus:border-electric resize-none"
                  placeholder="e.g. Custom branding, rush delivery, specific dimensions..."
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <Link
              href={`${base}/quotes`}
              className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-electric text-white text-sm font-semibold rounded-lg hover:bg-electric-light transition shadow-sm disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating proposals...
                </>
              ) : (
                <>
                  <SparklesIcon className="h-4 w-4" />
                  Generate 3 Proposals
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* ── Proposals View ─────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Summary Bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Quote request for</p>
                <p className="text-lg font-bold text-navy">
                  {formData.clientCompany} — {formData.clientName}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Budget: {fmt(formData.budget)} · Volume: {formData.volume} units
                  {formData.category && ` · ${formData.category}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep('form')}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Modify Request
                </button>
              </div>
            </div>
          </div>

          {/* 3 Proposals Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {proposals.map((proposal) => {
              const accent = tierAccent[proposal.tier]
              return (
                <div
                  key={proposal.tier}
                  className={`bg-white rounded-xl border-2 ${accent.border} overflow-hidden flex flex-col ${
                    proposal.tier === 'STANDARD' ? 'ring-2 ' + accent.ring : ''
                  }`}
                >
                  {/* Tier Header */}
                  <div className={`${accent.bg} px-5 py-4 border-b border-gray-100`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full ${accent.badge}`}>
                        {proposal.tier}
                      </span>
                      {proposal.tier === 'STANDARD' && (
                        <span className="text-xs font-semibold text-electric">Recommended</span>
                      )}
                      {proposal.includesVisualMockup && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                          <EyeIcon className="h-3.5 w-3.5" />
                          Visual Mockup
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-navy">{proposal.label}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{proposal.description}</p>
                  </div>

                  {/* Price */}
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-3xl font-bold text-navy">{fmt(proposal.total)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Subtotal {fmt(proposal.subtotal)} + TPS {fmt(proposal.gst)} + TVQ {fmt(proposal.qst)}
                    </p>
                  </div>

                  {/* Profitability Indicator (internal) */}
                  <div className={`mx-5 mt-4 px-3 py-2 rounded-lg border text-sm ${marginBg(proposal.marginPercent)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {proposal.marginPercent >= 25 ? (
                          <CheckCircleIcon className={`h-4 w-4 ${marginColor(proposal.marginPercent)}`} />
                        ) : proposal.marginPercent >= 15 ? (
                          <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" />
                        ) : (
                          <ShieldExclamationIcon className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`font-semibold ${marginColor(proposal.marginPercent)}`}>
                          {proposal.marginPercent.toFixed(1)}% margin
                        </span>
                      </div>
                      <span className="font-mono text-xs text-gray-500">
                        {fmt(proposal.marginDollars)} profit
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span>Revenue: {fmt(proposal.subtotal)}</span>
                      <span>Cost: {fmt(proposal.totalCost)}</span>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="flex-1 px-5 py-3">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Items ({proposal.lines.length})
                    </h4>
                    <div className="space-y-2">
                      {proposal.lines.map((line, i) => (
                        <div key={i} className="flex items-start justify-between text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{line.name}</p>
                            <p className="text-xs text-gray-500">
                              {line.quantity}× @ {fmt(line.unitPrice)}
                              <span className={`ml-2 ${marginColor(line.marginPercent)}`}>
                                ({line.marginPercent.toFixed(0)}% margin)
                              </span>
                            </p>
                          </div>
                          <p className="font-mono text-sm text-gray-900 ml-3">{fmt(line.lineTotal)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 py-4 border-t border-gray-100 mt-auto">
                    <button
                      onClick={() => {
                        // Store proposal in sessionStorage and navigate to create quote
                        sessionStorage.setItem('proposal', JSON.stringify({
                          ...proposal,
                          clientName: formData.clientName,
                          clientEmail: formData.clientEmail,
                          clientCompany: formData.clientCompany,
                        }))
                        router.push(`${base}/quotes/new?tier=${proposal.tier}`)
                      }}
                      className={`w-full px-4 py-2.5 text-sm font-semibold rounded-lg transition ${
                        proposal.tier === 'STANDARD'
                          ? 'bg-electric text-white hover:bg-electric-light shadow-sm'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Select &amp; Create Quote
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-navy flex items-center gap-2">
                <ChartBarIcon className="h-4 w-4 text-gray-400" />
                Profitability Comparison
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Metric</th>
                  {proposals.map((p) => (
                    <th key={p.tier} className="text-right px-6 py-3 font-medium text-gray-500">{p.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-50">
                  <td className="px-6 py-3 text-gray-700">Client Price (TTC)</td>
                  {proposals.map((p) => (
                    <td key={p.tier} className="px-6 py-3 text-right font-mono font-semibold">{fmt(p.total)}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="px-6 py-3 text-gray-700">Our Cost</td>
                  {proposals.map((p) => (
                    <td key={p.tier} className="px-6 py-3 text-right font-mono text-gray-600">{fmt(p.totalCost)}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="px-6 py-3 text-gray-700">Profit ($)</td>
                  {proposals.map((p) => (
                    <td key={p.tier} className={`px-6 py-3 text-right font-mono font-semibold ${marginColor(p.marginPercent)}`}>
                      {fmt(p.marginDollars)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="px-6 py-3 text-gray-700">Margin (%)</td>
                  {proposals.map((p) => (
                    <td key={p.tier} className={`px-6 py-3 text-right font-semibold ${marginColor(p.marginPercent)}`}>
                      {p.marginPercent.toFixed(1)}%
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-3 text-gray-700">Visual Mockup</td>
                  {proposals.map((p) => (
                    <td key={p.tier} className="px-6 py-3 text-right">
                      {p.includesVisualMockup ? (
                        <span className="text-amber-600 font-semibold">Included</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
