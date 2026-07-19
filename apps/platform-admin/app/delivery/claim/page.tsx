'use client'

/**
 * SAGE Phase 8A — recipient invitation claim surface
 *
 * Reads the one-time token from the URL FRAGMENT (never the query string, so it
 * is never sent in a Referer or logged server-side), immediately strips it from
 * browser history with replaceState, and POSTs it once to the claim endpoint.
 * The token is never rendered after the claim.
 */
import { useEffect, useRef, useState } from 'react'

type ClaimState =
  | { phase: 'idle' }
  | { phase: 'need-email' }
  | { phase: 'claiming' }
  | { phase: 'claimed'; grantId: string }
  | { phase: 'error'; message: string }

export default function DeliveryClaimPage() {
  const tokenRef = useRef<string | null>(null)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<ClaimState>({ phase: 'idle' })

  useEffect(() => {
    const fragment = window.location.hash
    const match = fragment.match(/token=([^&]+)/)
    if (match) {
      tokenRef.current = decodeURIComponent(match[1])
      // Strip the token from the URL + browser history immediately.
      window.history.replaceState(null, '', window.location.pathname)
    }
    // Defer the state transition out of the effect body (browser-only signal).
    const next: ClaimState = match ? { phase: 'need-email' } : { phase: 'error', message: 'This invitation link is invalid.' }
    const id = window.setTimeout(() => setState(next), 0)
    return () => window.clearTimeout(id)
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const token = tokenRef.current
    if (!token) return
    setState({ phase: 'claiming' })
    try {
      const res = await fetch('/api/delivery/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The token travels only in the request body, never the URL/Referer.
        body: JSON.stringify({ token, verifiedEmail: email }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setState({ phase: 'error', message: 'The invitation is invalid or has expired.' })
        return
      }
      // Store the grant-scoped session credential for the download step.
      try {
        window.sessionStorage.setItem(`sage-delivery-session:${json.data.grantId}`, json.data.sessionToken)
      } catch {
        /* sessionStorage may be unavailable; the download page will re-prompt. */
      }
      tokenRef.current = null // never keep the invitation token after claim
      setState({ phase: 'claimed', grantId: json.data.grantId })
    } catch {
      setState({ phase: 'error', message: 'The invitation could not be claimed.' })
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-xl font-semibold text-gray-900">Secure delivery</h1>
      <p className="text-sm text-gray-600">This mailbox-verified access is intended only for the person controlling the invited email address. Access may be revoked or expire.</p>

      {state.phase === 'need-email' && (
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="verifiedEmail" className="block text-sm font-medium text-gray-700">
            Confirm control of your invited email address
          </label>
          <input
            id="verifiedEmail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2 text-sm"
            autoComplete="email"
          />
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Claim invitation
          </button>
        </form>
      )}

      {state.phase === 'claiming' && <p className="text-sm text-gray-600">Claiming…</p>}

      {state.phase === 'claimed' && (
        <div role="status" className="space-y-3">
          <p className="text-sm text-green-800">Access granted. The package is integrity-checked before download.</p>
          <a href={`/delivery/${state.phase === 'claimed' ? state.grantId : ''}`} className="text-blue-600 underline">
            Continue to your secure package
          </a>
        </div>
      )}

      {state.phase === 'error' && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
    </main>
  )
}
