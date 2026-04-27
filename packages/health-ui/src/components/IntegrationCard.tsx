import React from 'react'

export type IntegrationStatus = 'ok' | 'degraded' | 'fail'

export interface IntegrationCardProps {
  name: string
  status: IntegrationStatus
  lastChecked?: string
  latencyMs?: number
  message?: string
}

const statusIcons: Record<IntegrationStatus, string> = {
  ok: '✓',
  degraded: '⚠',
  fail: '✗',
}

export function IntegrationCard({
  name,
  status,
  lastChecked,
  latencyMs,
  message,
}: IntegrationCardProps) {
  return (
    <div
      className={`integration-card integration-card--${status}`}
      role="region"
      aria-label={`Integration ${name}: ${status}`}
    >
      <div className="integration-card__header">
        <span className="integration-card__name">{name}</span>
        <span className="integration-card__status-icon" aria-hidden="true">
          {statusIcons[status]}
        </span>
        <span className="integration-card__status">{status}</span>
      </div>
      {lastChecked && (
        <div className="integration-card__meta">Last checked: {lastChecked}</div>
      )}
      {latencyMs !== undefined && (
        <div className="integration-card__latency">{latencyMs}ms</div>
      )}
      {message && <div className="integration-card__message">{message}</div>}
    </div>
  )
}
