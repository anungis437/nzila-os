'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

/**
 * Sign-out control for the password (nzila_session) auth flow.
 *
 * POSTs to /api/auth/logout (clears the session cookie + revokes the session),
 * then sends the user back to the sign-in screen.
 */
export function SignOutButton({
  className = '',
  variant = 'button',
}: {
  className?: string
  /** 'button' renders a full button; 'menu' renders a compact menu row. */
  variant?: 'button' | 'menu'
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /* logout is best-effort — always proceed to sign-in */
    } finally {
      router.push('/sign-in')
      router.refresh()
    }
  }

  if (variant === 'menu') {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 ${className}`}
      >
        <ArrowRightOnRectangleIcon className="h-4 w-4" />
        {loading ? 'Signing out…' : 'Sign out'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 ${className}`}
    >
      <ArrowRightOnRectangleIcon className="h-4 w-4" />
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
