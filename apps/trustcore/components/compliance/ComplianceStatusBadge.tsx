/**
 * TrustCore — Compliance Status Badge
 *
 * Renders a colour-coded pill for a ComplianceStatus value.
 */

import type { ComplianceStatus } from '@/types/core'

const STATUS_STYLES: Record<ComplianceStatus, string> = {
  compliant: 'bg-green-100 text-green-700',
  'at-risk': 'bg-yellow-100 text-yellow-700',
  'non-compliant': 'bg-red-100 text-red-700',
}

interface ComplianceStatusBadgeProps {
  status: ComplianceStatus
}

export function ComplianceStatusBadge({ status }: ComplianceStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}
