import { SkeletonKpiStrip, SkeletonTable } from '@/components/ui'

export default function RevenueLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="p-6 md:p-8 space-y-6">
      <span className="sr-only">Loading Revenue…</span>
      <SkeletonKpiStrip count={3} />
      <SkeletonTable rows={6} />
    </div>
  )
}
