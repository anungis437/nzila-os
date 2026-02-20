'use client'

import { useState } from 'react'
import { Button } from '@nzila/ui'

interface QboConnectButtonProps {
  entityId: string
  connected: boolean
  realmId?: string | null
  companyName?: string | null
  connectedAt?: string | null
}

export function QboConnectButton({
  entityId,
  connected,
  realmId,
  companyName,
  connectedAt,
}: QboConnectButtonProps) {
  const [loading, setLoading] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/qbo/connect?entityId=${entityId}`)
      const data = (await res.json()) as { authUrl?: string; error?: string }
      if (!res.ok || !data.authUrl) {
        throw new Error(data.error ?? 'Failed to build authorization URL')
      }
      window.location.href = data.authUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect QuickBooks Online? Token access will be revoked immediately.')) return
    setDisconnecting(true)
    setError(null)
    try {
      const res = await fetch(`/api/qbo/status?entityId=${entityId}`, { method: 'DELETE' })
      const data = (await res.json()) as { disconnected?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Disconnect failed')
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setDisconnecting(false)
    }
  }

  if (connected) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Connected
          </span>
          {companyName && (
            <span className="text-sm text-gray-600 font-medium">{companyName}</span>
          )}
          {realmId && (
            <span className="text-xs text-gray-400 font-mono">realm: {realmId}</span>
          )}
        </div>
        {connectedAt && (
          <p className="text-xs text-gray-400">
            Connected {new Date(connectedAt).toLocaleDateString('en-CA', { dateStyle: 'medium' })}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={handleConnect} disabled={loading}>
            {loading ? 'Redirecting…' : 'Reconnect'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Button variant="primary" size="sm" onClick={handleConnect} disabled={loading}>
        {loading ? 'Redirecting to Intuit…' : 'Connect QuickBooks Online'}
      </Button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
