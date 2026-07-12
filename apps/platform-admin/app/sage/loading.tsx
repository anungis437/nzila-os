/**
 * Platform Admin — SAGE index loading state.
 */
export default function Loading() {
  return (
    <div className="p-6" role="status" aria-live="polite">
      <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
      <div className="mt-6 space-y-2">
        <div className="h-10 animate-pulse rounded bg-gray-100" />
        <div className="h-10 animate-pulse rounded bg-gray-100" />
        <div className="h-10 animate-pulse rounded bg-gray-100" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
