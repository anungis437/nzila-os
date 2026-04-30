import { SkeletonKpiStrip, SkeletonTable } from '@/components/ui'

export default function CapitalLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="p-6 md:p-8 space-y-6">
      <span className="sr-only">Loading Capital…</span>
      <SkeletonKpiStrip count={4} />
      <SkeletonTable rows={8} />
    </div>
  )
}
