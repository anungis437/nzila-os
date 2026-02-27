/**
 * Penalty Estimator — Client Component.
 *
 * Interactive calculator for T2 late filing and GST/HST late penalties.
 * Uses @nzila/tax penalty functions.
 */
'use client'

import { useState } from 'react'
import {
  calculateT2LateFilingPenalty,
  calculateGstLatePenalty,
} from '@/lib/tax'

type PenaltyType = 't2' | 'gst'

const inputClasses =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-electric/40'

export function PenaltyEstimator() {
  const [type, setType] = useState<PenaltyType>('t2')
  const [taxOwing, setTaxOwing] = useState('')
  const [monthsLate, setMonthsLate] = useState('')
  const [isRepeat, setIsRepeat] = useState(false)
  const [result, setResult] = useState<{ penalty: number; effectiveRate: number; rule: string } | null>(null)

  function calculate() {
    const owing = parseFloat(taxOwing) || 0
    const months = parseInt(monthsLate) || 0
    if (owing <= 0 || months <= 0) return

    if (type === 't2') {
      const r = calculateT2LateFilingPenalty({ taxOwing: owing, monthsLate: months, isRepeatOffender: isRepeat })
      setResult({ penalty: r.penalty, effectiveRate: r.effectiveRate, rule: r.rule })
    } else {
      const r = calculateGstLatePenalty({ netTaxOwing: owing, monthsLate: months, isRepeatOffender: isRepeat })
      const effectiveRate = owing > 0 ? r.penalty / owing : 0
      setResult({ penalty: r.penalty, effectiveRate, rule: r.rule })
    }
  }

  return (
    <div className="space-y-4">
      {/* Type Toggle */}
      <div className="flex rounded-lg border border-border">
        <button
          onClick={() => { setType('t2'); setResult(null) }}
          className={`flex-1 rounded-l-lg px-3 py-2 text-xs font-medium transition-colors ${
            type === 't2' ? 'bg-electric/10 text-electric' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          T2 Corporate
        </button>
        <button
          onClick={() => { setType('gst'); setResult(null) }}
          className={`flex-1 rounded-r-lg px-3 py-2 text-xs font-medium transition-colors ${
            type === 'gst' ? 'bg-electric/10 text-electric' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          GST/HST
        </button>
      </div>

      {/* Inputs */}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {type === 't2' ? 'Tax Owing ($)' : 'Net GST/HST Owing ($)'}
          </label>
          <input
            type="number"
            min="0"
            step="100"
            className={inputClasses}
            placeholder="e.g. 25000"
            value={taxOwing}
            onChange={(e) => setTaxOwing(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Months Late
          </label>
          <input
            type="number"
            min="1"
            max={type === 't2' ? 20 : 12}
            className={inputClasses}
            placeholder="e.g. 3"
            value={monthsLate}
            onChange={(e) => setMonthsLate(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={isRepeat}
            onChange={(e) => setIsRepeat(e.target.checked)}
            className="rounded border-border"
          />
          Repeat offender (filed late in last 3 years)
        </label>
      </div>

      {/* Calculate Button */}
      <button
        onClick={calculate}
        className="w-full rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-electric/90"
      >
        Calculate Penalty
      </button>

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-muted-foreground">Estimated Penalty</span>
            <span className="text-xl font-bold text-red-500">
              ${result.penalty.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Effective rate</span>
            <span className="text-sm font-medium text-foreground">
              {(result.effectiveRate * 100).toFixed(1)}%
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{result.rule}</p>
        </div>
      )}
    </div>
  )
}
