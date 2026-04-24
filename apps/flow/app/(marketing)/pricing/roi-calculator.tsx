'use client'

import { useMemo, useState } from 'react'

export function RoiCalculator() {
  const [monthlyOrders, setMonthlyOrders] = useState(80)
  const [avgOrderValue, setAvgOrderValue] = useState(240)
  const [hoursSavedWeekly, setHoursSavedWeekly] = useState(8)

  const roi = useMemo(() => {
    const monthlyRevenue = monthlyOrders * avgOrderValue
    const yearlyRecoveredHours = hoursSavedWeekly * 52
    const hourValueCad = 65
    const efficiencyGain = yearlyRecoveredHours * hourValueCad
    return {
      monthlyRevenue,
      yearlyRecoveredHours,
      annualImpact: efficiencyGain + monthlyRevenue * 0.08,
    }
  }, [monthlyOrders, avgOrderValue, hoursSavedWeekly])

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-navy">SMB ROI Calculator</h2>
      <p className="mt-1 text-sm text-gray-600">Estimate annual impact from faster quote-to-cash cycles.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="text-sm text-gray-700">
          Monthly orders
          <input
            type="number"
            min={1}
            value={monthlyOrders}
            onChange={(event) => setMonthlyOrders(Number(event.target.value || 0))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-gray-700">
          Average order value (CAD)
          <input
            type="number"
            min={1}
            value={avgOrderValue}
            onChange={(event) => setAvgOrderValue(Number(event.target.value || 0))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-gray-700">
          Hours saved per week
          <input
            type="number"
            min={1}
            value={hoursSavedWeekly}
            onChange={(event) => setHoursSavedWeekly(Number(event.target.value || 0))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Monthly throughput</p>
          <p className="mt-1 text-xl font-bold text-navy">CAD {roi.monthlyRevenue.toLocaleString('en-CA')}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Recovered hours/year</p>
          <p className="mt-1 text-xl font-bold text-navy">{roi.yearlyRecoveredHours.toLocaleString('en-CA')}</p>
        </div>
        <div className="rounded-lg bg-electric/10 p-4">
          <p className="text-xs uppercase tracking-wide text-electric">Estimated annual impact</p>
          <p className="mt-1 text-xl font-bold text-electric">CAD {Math.round(roi.annualImpact).toLocaleString('en-CA')}</p>
        </div>
      </div>
    </section>
  )
}
