/**
 * CFO — Multi-Year Salary vs Dividend Projection (Client Component).
 *
 * Renders a multi-year projection chart showing the after-tax cash
 * and cumulative RRSP/TFSA impact of salary-only vs dividend-only
 * strategies using @nzila/tax projections.
 */
'use client'

import { useState, useMemo, useTransition } from 'react'
import { TrendingUp, ArrowUpRight, ArrowDownRight, Loader2, Info } from 'lucide-react'
import {
  projectMultiYear,
  calculateTfsaImpact,
  getCombinedCorporateRates,
  getCombinedMarginalRate,
  type MultiYearProjection,
  type TfsaImpact,
  type Province,
} from '@nzila/tax'

/* ── Types ────────────────────────────────────────────────────────────────── */

interface ProjectionResult {
  salary: MultiYearProjection
  eligibleDividend: MultiYearProjection
  nonEligibleDividend: MultiYearProjection
}

/* ── Constants ────────────────────────────────────────────────────────────── */

const PROVINCES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
] as const

const DEFAULT_INCOME = 200_000
const DEFAULT_YEARS = 5
const DEFAULT_GROWTH = 0.03
const BAR_COLORS = {
  salary: 'bg-electric',
  dividend: 'bg-green-500',
} as const

/* ── Component ────────────────────────────────────────────────────────────── */

export function MultiYearProjection() {
  const [corporateIncome, setCorporateIncome] = useState(DEFAULT_INCOME)
  const [province, setProvince] = useState<Province>('ON')
  const [years, setYears] = useState(DEFAULT_YEARS)
  const [growthRate, setGrowthRate] = useState(DEFAULT_GROWTH)
  const [projection, setProjection] = useState<ProjectionResult | null>(null)
  const [tfsaImpact, setTfsaImpact] = useState<TfsaImpact | null>(null)
  const [isPending, startTransition] = useTransition()

  /* ── Run projection ──────────────────────────────────────────────────── */

  const handleProject = () => {
    startTransition(() => {
      const rates = getCombinedCorporateRates(province)
      const marginalRate = getCombinedMarginalRate(province, corporateIncome)

      const result = projectMultiYear(
        corporateIncome,
        province,
        marginalRate,
        rates.combinedSmallBusinessRate,
        years,
      )
      setProjection(result)

      // Calculate TFSA impact using the first year's salary after-tax
      const firstYear = result.salary.projections[0]
      if (firstYear) {
        const tfsa = calculateTfsaImpact(
          firstYear.afterTaxCash,
          marginalRate,
          years,
        )
        setTfsaImpact(tfsa)
      }
    })
  }

  /* ── Derived stats ──────────────────────────────────────────────────── */

  const cumulativeSalary = projection?.salary.totalAfterTax ?? 0
  const cumulativeDividend = projection?.eligibleDividend.totalAfterTax ?? 0
  const winner = cumulativeSalary >= cumulativeDividend ? 'salary' : 'dividend'
  const advantage = Math.abs(cumulativeSalary - cumulativeDividend)

  /* ── Max value for chart scaling ─────────────────────────────────────── */

  const maxAfterTax = useMemo(() => {
    if (!projection) return 1
    const allValues = [
      ...projection.salary.projections.map((p) => p.afterTaxCash),
      ...projection.eligibleDividend.projections.map((p) => p.afterTaxCash),
    ]
    return Math.max(...allValues, 1)
  }, [projection])

  return (
    <div className="space-y-6">
      {/* ── Input form ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Corporate Income ($)
          </label>
          <input
            type="number"
            value={corporateIncome}
            onChange={(e) => setCorporateIncome(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
                       text-foreground focus:outline-none focus:ring-2 focus:ring-electric/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Province</label>
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value as Province)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
                       text-foreground focus:outline-none focus:ring-2 focus:ring-electric/40"
          >
            {PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Years</label>
          <input
            type="number"
            min={1}
            max={20}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
                       text-foreground focus:outline-none focus:ring-2 focus:ring-electric/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Growth Rate (%)
          </label>
          <input
            type="number"
            step={0.5}
            min={0}
            max={20}
            value={growthRate * 100}
            onChange={(e) => setGrowthRate(Number(e.target.value) / 100)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
                       text-foreground focus:outline-none focus:ring-2 focus:ring-electric/40"
          />
        </div>
      </div>

      <button
        onClick={handleProject}
        disabled={isPending || corporateIncome <= 0}
        className="rounded-lg bg-electric px-5 py-2.5 text-sm font-medium text-white shadow-sm
                   transition-colors hover:bg-electric/90 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />
        ) : (
          <TrendingUp className="mr-1.5 inline h-4 w-4" />
        )}
        Run {years}-Year Projection
      </button>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {projection && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Cumulative Salary After-Tax</p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                ${cumulativeSalary.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">
                Cumulative Dividend After-Tax
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                ${cumulativeDividend.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">
                {years}-Year Winner
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground flex items-center gap-1.5">
                {winner === 'salary' ? (
                  <ArrowUpRight className="h-5 w-5 text-electric" />
                ) : (
                  <ArrowUpRight className="h-5 w-5 text-green-500" />
                )}
                {winner === 'salary' ? 'Salary' : 'Dividends'} by $
                {advantage.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* TFSA impact card */}
          {tfsaImpact && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="mb-2 text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Info className="h-3.5 w-3.5" /> TFSA Impact ({years}-yr projection)
              </p>
              <div className="grid gap-4 sm:grid-cols-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Annual Room</p>
                  <p className="font-semibold">${tfsaImpact.annualRoom.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tax-Free Growth</p>
                  <p className="font-semibold text-green-600">
                    ${tfsaImpact.taxFreeGrowthValue.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Taxable Alternative</p>
                  <p className="font-semibold">${tfsaImpact.taxableAlternativeValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">TFSA Advantage</p>
                  <p className="font-semibold text-electric">
                    +${tfsaImpact.tfsaAdvantage.toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{tfsaImpact.note}</p>
            </div>
          )}

          {/* Chart – horizontal bar chart */}
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-electric" /> Salary
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-green-500" /> Dividends
              </span>
            </div>

            {projection.salary.projections.map((salaryYear, i) => {
              const dividendYear = projection.eligibleDividend.projections[i]
              return (
                <div key={i} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Year {salaryYear.year} · $
                    {corporateIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })} income
                  </p>
                  <div className="flex gap-1.5 items-center">
                    <div
                      className={`h-5 rounded ${BAR_COLORS.salary} transition-all duration-500`}
                      style={{ width: `${(salaryYear.afterTaxCash / maxAfterTax) * 100}%` }}
                    />
                    <span className="text-xs font-mono text-foreground whitespace-nowrap">
                      ${salaryYear.afterTaxCash.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <div
                      className={`h-5 rounded ${BAR_COLORS.dividend} transition-all duration-500`}
                      style={{ width: `${(dividendYear.afterTaxCash / maxAfterTax) * 100}%` }}
                    />
                    <span className="text-xs font-mono text-foreground whitespace-nowrap">
                      ${dividendYear.afterTaxCash.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* RRSP impacts */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Year</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Salary After-Tax</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Dividend After-Tax</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">RRSP Room (Salary)</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {projection.salary.projections.map((salaryYear, i) => {
                  const dividendYear = projection.eligibleDividend.projections[i]
                  const diff = salaryYear.afterTaxCash - dividendYear.afterTaxCash
                  return (
                    <tr key={i} className="hover:bg-secondary/50">
                      <td className="px-4 py-3 text-foreground">Year {salaryYear.year}</td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        ${salaryYear.afterTaxCash.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        ${dividendYear.afterTaxCash.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        ${salaryYear.rrspRoomAccumulated.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                            diff >= 0 ? 'text-electric' : 'text-green-600'
                          }`}
                        >
                          {diff >= 0 ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          ${Math.abs(diff).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
