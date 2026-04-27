import React from 'react'

export type ConsentStatus = 'allowed' | 'restricted' | 'break-glass'

export interface ConsentBadgeProps {
  status: ConsentStatus
  scope?: string
}

const statusLabels: Record<ConsentStatus, string> = {
  allowed: '✓ Access Allowed',
  restricted: '✗ Access Restricted',
  'break-glass': '🔓 Break-Glass Access',
}

const statusClassNames: Record<ConsentStatus, string> = {
  allowed: 'consent-badge--allowed',
  restricted: 'consent-badge--restricted',
  'break-glass': 'consent-badge--break-glass',
}

export function ConsentBadge({ status, scope }: ConsentBadgeProps) {
  return (
    <span
      className={`consent-badge ${statusClassNames[status]}`}
      aria-label={`Consent status: ${statusLabels[status]}${scope ? ` for ${scope}` : ''}`}
      role="status"
    >
      {statusLabels[status]}
      {scope && <span className="consent-badge__scope"> ({scope})</span>}
    </span>
  )
}
