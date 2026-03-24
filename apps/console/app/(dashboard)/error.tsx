'use client'

import { ShieldExclamationIcon } from '@heroicons/react/24/outline'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isForbidden = error.message.startsWith('Forbidden:')

  if (isForbidden) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 max-w-md text-center">
          <ShieldExclamationIcon className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Access Restricted
          </h2>
          <p className="text-gray-600 text-sm mb-1">
            {error.message.replace('Forbidden: r', 'R')}
          </p>
          <p className="text-gray-500 text-xs mt-3">
            Contact your platform administrator to request elevated access.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-600 text-sm mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
