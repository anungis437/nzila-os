import { SkeletonKpiStrip, SkeletonCard } from '@/components/ui'

export default function IntelligenceLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="p-6 md:p-8 space-y-6">
      <span className="sr-only">Loading Intelligence…</span>
      <div className="space-y-2">
        <div className="h-7 w-56 rounded bg-gray-200 motion-safe:animate-pulse" />
        <div className="h-4 w-80 rounded bg-gray-100 motion-safe:animate-pulse" />
      </div>
      <SkeletonKpiStrip count={3} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    </div>
  )
}
