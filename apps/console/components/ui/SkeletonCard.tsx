/**
 * Console skeleton primitives — calm, layout-stable loading placeholders.
 *
 * Use within <Suspense> or `loading.tsx`. Always pair with `aria-busy`
 * on a parent container so screen readers announce loading state.
 */
import { cn } from './cn'

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn('h-3 rounded bg-gray-100 motion-safe:animate-pulse', className)} />
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('rounded-lg bg-gray-100 motion-safe:animate-pulse', className)} />
}

export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm motion-safe:animate-pulse',
        className,
      )}
    >
      <div className="mb-3 h-3 w-20 rounded bg-gray-100" />
      <div className="mb-4 h-7 w-32 rounded bg-gray-200" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-gray-100" />
        ))}
      </div>
    </div>
  )
}

export function SkeletonKpiStrip({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={1} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 h-4 w-40 rounded bg-gray-200 motion-safe:animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-gray-50 motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  )
}
