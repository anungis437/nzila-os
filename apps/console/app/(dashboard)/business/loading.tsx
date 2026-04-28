import { SkeletonKpiStrip, SkeletonCard } from '@/components/ui'

export default function BusinessLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="p-6 md:p-8 space-y-6">
      <span className="sr-only">Loading Business…</span>
      <SkeletonKpiStrip count={4} />
      <SkeletonCard lines={5} />
    </div>
  )
}
