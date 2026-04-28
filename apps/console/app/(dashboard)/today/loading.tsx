import { SkeletonKpiStrip, SkeletonTable } from '@/components/ui'

export default function TodayLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="p-6 md:p-8 space-y-6">
      <span className="sr-only">Loading Today…</span>
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-gray-200 motion-safe:animate-pulse" />
        <div className="h-4 w-72 rounded bg-gray-100 motion-safe:animate-pulse" />
      </div>
      <SkeletonKpiStrip count={4} />
      <SkeletonTable rows={6} />
    </div>
  )
}
