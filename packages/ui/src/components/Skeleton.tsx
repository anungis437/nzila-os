import React from 'react'

/**
 * Skeleton — width-stable placeholder.
 *
 * Animates only opacity (no shimmer sweep) — calm by design, and
 * automatically halts when `prefers-reduced-motion: reduce`. The
 * exported sub-shapes (`Skeleton.Line`, `.Block`, `.KpiStrip`) cover
 * 95% of cases so consumers don't reinvent loading states per page.
 */
interface SkeletonBaseProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional content — usually unused. Skeleton is presentational. */
  children?: React.ReactNode
}

function SkeletonBox({ className = '', ...props }: SkeletonBaseProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-live="polite"
      className={`bg-[var(--color-surface-3)] animate-pulse rounded-[var(--radius-sm)] ${className}`}
      {...props}
    />
  )
}

function SkeletonLine({ width = '100%', className = '', ...props }: SkeletonBaseProps & { width?: string | number }) {
  return (
    <SkeletonBox
      className={`h-3 ${className}`}
      style={{ width: typeof width === 'number' ? `${width}px` : width, ...(props.style ?? {}) }}
      {...props}
    />
  )
}

function SkeletonBlock({ className = '', ...props }: SkeletonBaseProps) {
  return <SkeletonBox className={`h-24 w-full ${className}`} {...props} />
}

function SkeletonKpiStrip({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 p-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)]">
          <SkeletonLine width={80} />
          <SkeletonLine width={120} className="h-5" />
          <SkeletonLine width={60} />
        </div>
      ))}
    </div>
  )
}

function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden">
      <div className="grid gap-3 px-4 py-3 bg-[var(--color-surface-2)]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => <SkeletonLine key={i} width={80} />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3 px-4 py-3 border-t border-[var(--color-border)]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, c) => <SkeletonLine key={c} />)}
        </div>
      ))}
    </div>
  )
}

export const Skeleton = Object.assign(SkeletonBox, {
  Line: SkeletonLine,
  Block: SkeletonBlock,
  KpiStrip: SkeletonKpiStrip,
  Table: SkeletonTable,
})
