'use client'

/**
 * Platform Admin — SAGE index error boundary.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6" role="alert">
      <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
      <p className="mt-1 text-sm text-gray-500">
        The SAGE workspace view could not be loaded.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Try again
      </button>
    </div>
  )
}
