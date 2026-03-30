'use client'

import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[partners/admin]', error)
  }, [error])

  return (
    <div className="max-w-md mx-auto mt-24 text-center">
      <h2 className="text-xl font-bold text-slate-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-slate-500">
        {error.message || 'An unexpected error occurred in the admin panel.'}
      </p>
      <button
        onClick={reset}
        className="mt-6 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
      >
        Try again
      </button>
    </div>
  )
}
