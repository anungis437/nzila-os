/**
 * TrustCore — Compliance Score Widget
 *
 * Displays the org compliance score with a visual indicator.
 */

import type { ComplianceResult } from '@/types/core'

interface ComplianceScoreWidgetProps {
  result: ComplianceResult
}

export function ComplianceScoreWidget({ result }: ComplianceScoreWidgetProps) {
  const color =
    result.score >= 70
      ? 'text-green-700'
      : result.score >= 50
        ? 'text-yellow-700'
        : 'text-red-700'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm font-medium text-gray-500 mb-1">Compliance Score</p>
      <p className={`text-4xl font-bold ${color}`}>{result.score}</p>
      <p className="text-xs text-gray-400 mt-1 capitalize">{result.status}</p>
    </div>
  )
}
