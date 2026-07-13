'use client'

/**
 * SAGE Phase 8A — recipient secure package surface
 *
 * Uses the grant-scoped session credential (from claim) to download the
 * integrity-verified package and, separately, to acknowledge receipt. No
 * workspace/organization data or package listing beyond this single grant.
 */
import { use, useState } from 'react'

export default function DeliveryGrantPage({ params }: { params: Promise<{ grantId: string }> }) {
  const { grantId } = use(params)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function session(): string | null {
    try {
      return window.sessionStorage.getItem(`sage-delivery-session:${grantId}`)
    } catch {
      return null
    }
  }

  async function download() {
    const token = session()
    if (!token) {
      setMessage('Your session has ended. Please reopen your invitation.')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/delivery/${grantId}/download`, {
        method: 'POST',
        headers: { 'X-Delivery-Session': token },
      })
      if (!res.ok) {
        setMessage('Access is not available. It may have been revoked or expired.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sage-export-${grantId}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage('Your download has started.')
    } catch {
      setMessage('The download could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  async function acknowledge() {
    const token = session()
    if (!token) {
      setMessage('Your session has ended. Please reopen your invitation.')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/delivery/${grantId}/acknowledge`, {
        method: 'POST',
        headers: { 'X-Delivery-Session': token },
      })
      setMessage(res.ok ? 'Thank you — your receipt has been acknowledged.' : 'Acknowledgment is not available.')
    } catch {
      setMessage('The acknowledgment could not be recorded.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-xl font-semibold text-gray-900">Secure delivery</h1>
      <p className="text-sm text-gray-600">
        This access is intended only for the verified recipient. Access may be revoked or expire. The package is
        integrity-checked before download.
      </p>
      <div className="space-y-3">
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Download package
        </button>
        <button
          type="button"
          onClick={acknowledge}
          disabled={busy}
          className="block rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 disabled:opacity-50"
        >
          Acknowledge receipt
        </button>
      </div>
      {message && (
        <p role="status" className="text-sm text-gray-700">
          {message}
        </p>
      )}
    </main>
  )
}
