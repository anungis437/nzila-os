/**
 * Zonga — Dashboard Error Boundary.
 */
'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Zonga Error Boundary]', error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center">
      <span className="mb-4 text-4xl">⚠️</span>
      <h2 className="text-foreground text-xl font-bold">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. The error has been logged and our team has been notified.
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-muted-foreground">Error ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-electric px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-electric/90"
      >
        🔄 Try Again
      </button>
    </div>
  )
}
