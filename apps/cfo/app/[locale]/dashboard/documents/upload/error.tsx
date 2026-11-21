/**
 * CFO — Document Upload Error Boundary.
 */
'use client'

import { useEffect, useId } from 'react'
import { browserErrorReference, recordBrowserError } from '@nzila/os-core/browser-diagnostics'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const localReference = useId()
  const diagnosticReference = browserErrorReference(error.digest, localReference)

  useEffect(() => {
    recordBrowserError({ app: 'cfo', surface: 'documents-upload', code: 'CLIENT_BOUNDARY_ERROR',
      reference: diagnosticReference.value, referenceOrigin: diagnosticReference.origin })
  }, [error, diagnosticReference.value, diagnosticReference.origin])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-red-400" />
      <h2 className="font-poppins text-xl font-bold text-foreground">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. Please try again, or share the reference with support.
      </p>
      {diagnosticReference.value && (
        <p className="mt-1 text-xs text-muted-foreground">{diagnosticReference.origin === 'local' ? 'Local reference' : 'Reference'}: {diagnosticReference.value}</p>
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
