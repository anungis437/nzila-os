/**
 * CFO — Section Loading Skeleton.
 */
export default function SectionLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-secondary" />
        <div className="h-4 w-72 rounded bg-secondary" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-border bg-card shadow-sm">
            <div className="p-5 space-y-3">
              <div className="h-4 w-24 rounded bg-secondary" />
              <div className="h-7 w-16 rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <div className="h-5 w-32 rounded bg-secondary" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border/50 px-4 py-3">
            <div className="h-4 w-4 rounded bg-secondary" />
            <div className="h-4 w-48 rounded bg-secondary" />
            <div className="ml-auto h-4 w-20 rounded bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  )
}
