'use client'

import { useState } from 'react'

export function GenerateReportsButton({ entityId }: { entityId: string }) {
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  async function handleGenerate() {
    setLoading(true)
    try {
      const [year, mon] = month.split('-').map(Number)
      const startDate = new Date(Date.UTC(year, mon - 1, 1)).toISOString()
      const endDate = new Date(Date.UTC(year, mon, 0, 23, 59, 59)).toISOString()

      const res = await fetch('/api/stripe/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, startDate, endDate }),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(`Error: ${err.error ?? 'Unknown error'}`)
      } else {
        const data = await res.json()
        alert(`Generated ${data.count} reports successfully.`)
        window.location.reload()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <input
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="border rounded px-3 py-1.5 text-sm"
      />
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate Reports'}
      </button>
    </div>
  )
}

export function GenerateReportsAiActionButton({
  entityId,
  appKey = 'console',
  profileKey = 'finance',
}: {
  entityId: string
  appKey?: string
  profileKey?: string
}) {
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [result, setResult] = useState<{ actionId: string; status: string } | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setResult(null)
    try {
      const [year, mon] = month.split('-').map(Number)
      const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
      const lastDay = new Date(Date.UTC(year, mon, 0)).getDate()
      const endDate = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const res = await fetch('/api/ai/actions/finance/stripe-monthly-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          appKey,
          profileKey,
          period: {
            startDate,
            endDate,
            periodLabel: month,
          },
          outputs: ['revenue_summary', 'payout_recon', 'refunds_summary', 'disputes_summary'],
          evidence: {
            storeUnderEvidencePack: true,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(`Error: ${data.error ?? 'Unknown error'}`)
      } else {
        setResult({ actionId: data.actionId, status: data.status })
        if (data.status === 'success') {
          alert(`AI Action executed. ${data.outputArtifacts?.reportIds?.length ?? 0} reports generated.`)
          window.location.reload()
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        />
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Running AI Action...' : 'Generate Reports (AI Action)'}
        </button>
      </div>
      {result && (
        <div className="text-xs text-muted-foreground">
          Action <span className="font-mono">{result.actionId.slice(0, 8)}...</span> — {result.status}
        </div>
      )}
    </div>
  )
}
