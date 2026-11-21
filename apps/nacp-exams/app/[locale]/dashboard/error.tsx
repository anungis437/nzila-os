'use client'

import { useEffect, useId } from 'react'
import { browserErrorReference, recordBrowserError } from '@nzila/os-core/browser-diagnostics'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const localReference = useId()
  const diagnosticReference = browserErrorReference(error.digest, localReference)

  useEffect(() => {
    recordBrowserError({ app: 'nacp-exams', surface: 'dashboard', code: 'CLIENT_BOUNDARY_ERROR',
      reference: diagnosticReference.value, referenceOrigin: diagnosticReference.origin })
  }, [error, diagnosticReference.value, diagnosticReference.origin])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h2 className="text-xl font-bold text-navy mb-2">Something went wrong</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-md">
        An error occurred loading the dashboard. Please try again, or share the reference with support.
      </p>
      <p className="mt-2 text-xs text-gray-500">
        {diagnosticReference.origin === 'local' ? 'Local reference' : 'Reference'}: {diagnosticReference.value}
      </p>
      <button
        onClick={reset}
        className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition"
      >
        Try Again
      </button>
    </div>
  )
}
