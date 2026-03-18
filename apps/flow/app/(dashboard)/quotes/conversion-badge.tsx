'use client'

import { useEffect, useState } from 'react'

interface ConversionPrediction {
  probability: number
  factors: Array<{ name: string; impact: 'positive' | 'negative'; weight: number }>
  recommendation: string
}

export function ConversionBadge({ quoteId }: { quoteId: string }) {
  const [prediction, setPrediction] = useState<ConversionPrediction | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/quotes/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'predict', quoteId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.result) {
          setPrediction(data.result)
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    return () => { cancelled = true }
  }, [quoteId])

  if (!loaded) {
    return <span className="inline-block h-5 w-12 bg-gray-100 rounded animate-pulse" />
  }

  if (!prediction) return <span className="text-xs text-gray-400">—</span>

  const pct = Math.round(prediction.probability * 100)
  const color =
    pct >= 70
      ? 'bg-emerald-50 text-emerald-700'
      : pct >= 40
        ? 'bg-amber-50 text-amber-700'
        : 'bg-red-50 text-red-700'

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${color}`}
      title={prediction.recommendation}
    >
      {pct}%
    </span>
  )
}
