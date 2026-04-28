/**
 * Dashboard root loading state.
 *
 * Rendered automatically by Next.js while a dashboard route's server data
 * fetches. Designed as a calm skeleton — no layout shift, no spinners.
 * Use `aria-busy` so screen readers announce loading progress.
 */
export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="p-8 motion-safe:animate-pulse"
    >
      <span className="sr-only">Loading…</span>

      {/* Title row */}
      <div className="mb-8 space-y-3">
        <div className="h-7 w-1/3 rounded-md bg-gray-200" />
        <div className="h-4 w-1/2 rounded-md bg-gray-100" />
      </div>

      {/* KPI strip */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-3 h-3 w-20 rounded bg-gray-100" />
            <div className="mb-2 h-8 w-24 rounded bg-gray-200" />
            <div className="h-3 w-16 rounded bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Main panel */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-5 w-32 rounded bg-gray-200" />
          <div className="h-8 w-24 rounded-lg bg-gray-100" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-50" />
          ))}
        </div>
      </div>
    </div>
  )
}
