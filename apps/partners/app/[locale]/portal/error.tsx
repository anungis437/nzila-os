'use client'

import { useEffect, useId } from 'react'
import { browserErrorReference, recordBrowserError } from '@nzila/os-core/browser-diagnostics'

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const localReference = useId()
  const diagnosticReference = browserErrorReference(error.digest, localReference)

  useEffect(() => {
    recordBrowserError({ app: 'partners', surface: 'portal', code: 'CLIENT_BOUNDARY_ERROR',
      reference: diagnosticReference.value, referenceOrigin: diagnosticReference.origin })
  }, [error, diagnosticReference.value, diagnosticReference.origin])

  return (
    <div className="max-w-md mx-auto mt-24 text-center">
      <h2 className="text-xl font-bold text-slate-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-slate-500">
        {error.message || 'An unexpected error occurred in the partner portal.'}
      </p>
      <p className="mt-2 text-xs text-gray-500">
        {diagnosticReference.origin === 'local' ? 'Local reference' : 'Reference'}: {diagnosticReference.value}
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
