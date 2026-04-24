'use client'

import { useState } from 'react'

type MondayResetResponse = {
  ok: boolean
  mondayResetAt: string
  checklist: string[]
}

function weekKey(date: Date) {
  const year = date.getUTCFullYear()
  const firstJan = new Date(Date.UTC(year, 0, 1))
  const dayOfYear = Math.floor((date.getTime() - firstJan.getTime()) / 86400000) + 1
  const week = Math.ceil(dayOfYear / 7)
  return `${year}-W${week}`
}

export function MondayResetButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MondayResetResponse | null>(null)
  const [streak, setStreak] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    const value = window.localStorage.getItem('weekone_monday_streak')
    return value ? Number(value) : 0
  })

  async function triggerReset() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/monday-reset', { method: 'POST' })
      if (!res.ok) throw new Error('reset_failed')
      const data = (await res.json()) as MondayResetResponse
      setResult(data)

      const now = new Date()
      const thisWeek = weekKey(now)
      const lastWeek = window.localStorage.getItem('weekone_last_reset_week')
      const currentStreak = Number(window.localStorage.getItem('weekone_monday_streak') ?? '0')
      const nextStreak = lastWeek === thisWeek ? currentStreak : currentStreak + 1
      window.localStorage.setItem('weekone_last_reset_week', thisWeek)
      window.localStorage.setItem('weekone_monday_streak', String(nextStreak))
      setStreak(nextStreak)
    } catch {
      setError('Could not run Monday reset. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-electric/20 bg-electric/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-electric">Monday reset</p>
          <p className="text-sm text-navy">Run your weekly reset checklist and keep your execution streak alive.</p>
          <p className="mt-1 text-xs text-gray-600">Current streak: <strong>{streak}</strong></p>
        </div>
        <button
          type="button"
          onClick={triggerReset}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-electric px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? 'Running reset...' : 'Run Monday Reset'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="mt-4 rounded-lg border border-electric/20 bg-white p-3">
          <p className="text-xs text-gray-500">Completed at {new Date(result.mondayResetAt).toLocaleString()}</p>
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {result.checklist.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-electric" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
