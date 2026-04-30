import { SkeletonKpiStrip, SkeletonCard } from '@/components/ui'

export default function CommandCenterLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="p-6 md:p-8 space-y-6">
      <span className="sr-only">Loading Command Center…</span>
      <SkeletonKpiStrip count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    </div>
  )
}
