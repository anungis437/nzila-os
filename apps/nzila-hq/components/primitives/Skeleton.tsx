/**
 * Loading skeleton primitives — used by route-level `loading.tsx` files
 * to give every Nzila HQ surface a calm, on-brand placeholder while RSC
 * data resolves. Pure presentational, no dependencies.
 */
import { cn } from '@/lib/cn'

interface BaseProps {
  className?: string
}

export function SkeletonLine({ className }: BaseProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('h-3 w-full animate-pulse rounded bg-slate-200/80', className)}
    />
  )
}

export function SkeletonBlock({ className }: BaseProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-xl bg-slate-200/70', className)}
    />
  )
}

/** A 6-up KPI strip (matches `Stat` rhythm). */
export function SkeletonKpiStrip({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="rounded-xl bg-white p-4 ring-1 ring-slate-200"
        >
          <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-6 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-2 w-16 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

/** A skeleton card body — title + body lines. */
export function SkeletonCard({ lines = 4 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-2 w-48 animate-pulse rounded bg-slate-100" />
      <div className="mt-5 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine key={i} className={i === lines - 1 ? 'w-2/3' : ''} />
        ))}
      </div>
    </div>
  )
}

/** A skeleton table — header row + N body rows. */
export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-2.5 animate-pulse rounded bg-slate-200" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-4 px-6 py-4"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="h-3 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
