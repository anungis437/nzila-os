/**
 * Salary vs. Dividend Optimizer — Client Component.
 *
 * Compares after-tax cash to CCPC owner-manager under salary,
 * eligible dividend, and non-eligible dividend strategies.
 * Uses @nzila/tax dividend-tax and personal-rates functions.
 */
'use client'

import { useState } from 'react'
import {
  compareSalaryVsDividend,
  getCombinedMarginalRate,
  getCombinedCorporateRates,
} from '@/lib/tax'
import type { Province } from '@nzila/tax'

const provinces: { value: Province; label: string }[] = [
  { value: 'ON', label: 'Ontario' },
  { value: 'QC', label: 'Quebec' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'AB', label: 'Alberta' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'PE', label: 'PEI' },
  { value: 'NL', label: 'Newfoundland' },
  { value: 'YT', label: 'Yukon' },
  { value: 'NT', label: 'NWT' },
  { value: 'NU', label: 'Nunavut' },
]

const inputClasses =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-electric/40'

type Result = ReturnType<typeof compareSalaryVsDividend>

export function SalaryVsDividend() {
  const [income, setIncome] = useState('')
  const [province, setProvince] = useState<Province>('ON')
  const [isSmallBusiness, setIsSmallBusiness] = useState(true)
  const [result, setResult] = useState<Result | null>(null)

  function calculate() {
    const amt = parseFloat(income) || 0
    if (amt <= 0) return

    const rates = getCombinedCorporateRates(province)
    const corpRate = isSmallBusiness ? rates.combinedSmallBusinessRate : rates.combinedGeneralRate
    const personalRate = getCombinedMarginalRate(province, amt)
    const r = compareSalaryVsDividend(amt, province, personalRate, corpRate)
    setResult(r)
  }

  function fmt(n: number) {
    return n.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Corporate Pre-Tax Income ($)
          </label>
          <input
            type="number"
            min="0"
            step="1000"
            className={inputClasses}
            placeholder="e.g. 150000"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Province</label>
          <select
            className={inputClasses}
            value={province}
            onChange={(e) => setProvince(e.target.value as Province)}
          >
            {provinces.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={isSmallBusiness}
            onChange={(e) => setIsSmallBusiness(e.target.checked)}
            className="rounded border-border"
          />
          CCPC small business rate (SBD eligible)
        </label>
      </div>

      {/* Calculate */}
      <button
        onClick={calculate}
        className="w-full rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-electric/90"
      >
        Compare Strategies
      </button>

      {/* Results Table */}
      {result && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-3 py-2 font-medium text-muted-foreground"></th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Salary</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Eligible Div.</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Non-Eligible Div.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              <tr className="hover:bg-secondary/30">
                <td className="px-3 py-2 text-muted-foreground">Corp Tax</td>
                <td className="px-3 py-2 text-foreground">$0</td>
                <td className="px-3 py-2 text-foreground">${fmt(result.eligibleDividend.corpTax)}</td>
                <td className="px-3 py-2 text-foreground">${fmt(result.nonEligibleDividend.corpTax)}</td>
              </tr>
              <tr className="hover:bg-secondary/30">
                <td className="px-3 py-2 text-muted-foreground">Cash to Owner</td>
                <td className="px-3 py-2 text-foreground">${fmt(result.salary.gross)}</td>
                <td className="px-3 py-2 text-foreground">${fmt(result.eligibleDividend.cashDividend)}</td>
                <td className="px-3 py-2 text-foreground">${fmt(result.nonEligibleDividend.cashDividend)}</td>
              </tr>
              <tr className="hover:bg-secondary/30">
                <td className="px-3 py-2 text-muted-foreground">Personal Tax</td>
                <td className="px-3 py-2 text-foreground">${fmt(result.salary.personalTax)}</td>
                <td className="px-3 py-2 text-foreground">${fmt(result.eligibleDividend.personalTax)}</td>
                <td className="px-3 py-2 text-foreground">${fmt(result.nonEligibleDividend.personalTax)}</td>
              </tr>
              <tr className="hover:bg-secondary/30">
                <td className="px-3 py-2 text-muted-foreground">RDTOH Refund</td>
                <td className="px-3 py-2 text-foreground">—</td>
                <td className="px-3 py-2 text-emerald-500">${fmt(result.eligibleDividend.rdtohRefund)}</td>
                <td className="px-3 py-2 text-emerald-500">${fmt(result.nonEligibleDividend.rdtohRefund)}</td>
              </tr>
              <tr className="bg-secondary/30 font-medium hover:bg-secondary/50">
                <td className="px-3 py-2 text-foreground">After-Tax Cash</td>
                <td className="px-3 py-2 text-foreground">${fmt(result.salary.afterTax)}</td>
                <td className="px-3 py-2 text-foreground">${fmt(result.eligibleDividend.afterTax)}</td>
                <td className="px-3 py-2 text-foreground">${fmt(result.nonEligibleDividend.afterTax)}</td>
              </tr>
            </tbody>
          </table>
          {/* Best Option Highlight */}
          <div className="border-t border-border bg-electric/5 px-3 py-2">
            <p className="text-xs font-medium text-electric">
              {(() => {
                const best = [
                  { label: 'Salary', val: result.salary.afterTax },
                  { label: 'Eligible Dividend', val: result.eligibleDividend.afterTax },
                  { label: 'Non-Eligible Dividend', val: result.nonEligibleDividend.afterTax },
                ].sort((a, b) => b.val - a.val)[0]
                return `Best option: ${best.label} ($${fmt(best.val)} after tax)`
              })()}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
