/**
 * CFO — Section Error Boundary.
 */
'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[CFO Error]', error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-red-400" />
      <h2 className="font-poppins text-xl font-bold text-foreground">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. The error has been logged.
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-muted-foreground">Error ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-electric px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-electric/90"
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </button>
    </div>
  )
}
