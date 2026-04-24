'use client'

import { useCallback, useEffect, useState } from 'react'

type CheckInStat = {
  totalTickets: number
  checkedIn: number
  remaining: number
  percentCheckedIn: number
  recentCheckins: Array<{
    ticketType: string
    holderName: string
    scannedAt: string
  }>
}

type ScanResult = {
  ok: boolean
  message: string
  ticketType?: string
  holderName?: string
}

export function CheckInConsole({ eventId }: { eventId: string }) {
  const [qrToken, setQrToken] = useState('')
  const [manualTicketId, setManualTicketId] = useState('')
  const [loading, setLoading] = useState(false)
  const [manualLoading, setManualLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(true)
  const [stats, setStats] = useState<CheckInStat | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/checkin`, { cache: 'no-store' })
      if (!res.ok) throw new Error('stats_failed')
      const payload = (await res.json()) as { ok: boolean; data: CheckInStat }
      setStats(payload.data)
    } catch {
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  async function submitScan(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch(`/api/events/${eventId}/checkin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ qrToken: qrToken.trim() }),
      })

      const payload = (await res.json()) as {
        ok: boolean
        data?: { ok: boolean; message: string; ticketType?: string; holderName?: string }
      }

      if (!payload.data) {
        setResult({ ok: false, message: 'Could not process check-in.' })
      } else {
        setResult({
          ok: payload.data.ok,
          message: payload.data.message,
          ticketType: payload.data.ticketType,
          holderName: payload.data.holderName,
        })
      }

      if (payload.data?.ok) {
        setQrToken('')
        await loadStats()
      }
    } catch {
      setResult({ ok: false, message: 'Check-in request failed. Please retry.' })
    } finally {
      setLoading(false)
    }
  }

  async function submitManualOverride(e: React.FormEvent) {
    e.preventDefault()
    setManualLoading(true)
    setResult(null)

    try {
      const res = await fetch(`/api/events/${eventId}/checkin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ticketId: manualTicketId.trim() }),
      })

      const payload = (await res.json()) as {
        ok: boolean
        data?: { ok: boolean; message: string; ticketType?: string; holderName?: string }
      }

      if (!payload.data) {
        setResult({ ok: false, message: 'Manual override failed.' })
      } else {
        setResult({
          ok: payload.data.ok,
          message: payload.data.message,
          ticketType: payload.data.ticketType,
          holderName: payload.data.holderName,
        })
      }

      if (payload.data?.ok) {
        setManualTicketId('')
        await loadStats()
      }
    } catch {
      setResult({ ok: false, message: 'Manual override request failed. Please retry.' })
    } finally {
      setManualLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-foreground">QR Check-in Console</h2>
      <p className="mt-1 text-xs text-muted-foreground">Scan or paste a QR token to validate entry.</p>

      <form onSubmit={submitScan} className="mt-3 space-y-2">
        <input
          value={qrToken}
          onChange={(e) => setQrToken(e.target.value)}
          placeholder="Paste ticket QR token"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-electric py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Validating...' : 'Check In Ticket'}
        </button>
      </form>

      <form onSubmit={submitManualOverride} className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-medium text-amber-700">Manual override</p>
        <input
          value={manualTicketId}
          onChange={(e) => setManualTicketId(e.target.value)}
          placeholder="Enter ticket ID"
          className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm"
          required
        />
        <button
          type="submit"
          disabled={manualLoading}
          className="w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {manualLoading ? 'Applying override...' : 'Manual Check-in'}
        </button>
      </form>

      {result && (
        <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <p className="font-medium">{result.message}</p>
          {(result.holderName || result.ticketType) && (
            <p className="mt-1">
              {result.holderName ?? 'Unknown holder'}{result.ticketType ? ` — ${result.ticketType}` : ''}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-muted-foreground">Check-in Progress</p>
        {statsLoading ? (
          <p className="mt-1 text-xs text-gray-400">Loading stats...</p>
        ) : stats ? (
          <>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {stats.checkedIn} / {stats.totalTickets} checked in ({stats.percentCheckedIn}%)
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-electric" style={{ width: `${Math.min(100, stats.percentCheckedIn)}%` }} />
            </div>
            {stats.recentCheckins.length > 0 && (
              <div className="mt-3 max-h-36 overflow-y-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs text-gray-600">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-2 py-1 text-left">Holder</th>
                      <th className="px-2 py-1 text-left">Ticket</th>
                      <th className="px-2 py-1 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentCheckins.map((entry, index) => (
                      <tr key={`${entry.holderName}-${entry.scannedAt}-${index}`} className="border-t border-gray-50">
                        <td className="px-2 py-1 truncate max-w-28">{entry.holderName}</td>
                        <td className="px-2 py-1 truncate max-w-24">{entry.ticketType}</td>
                        <td className="px-2 py-1 text-right text-gray-400">{new Date(entry.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="mt-1 text-xs text-gray-400">Stats unavailable.</p>
        )}
      </div>
    </div>
  )
}
