import { SkeletonKpiStrip, SkeletonCard } from '@/components/primitives/Skeleton'
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-7 w-72 animate-pulse rounded bg-slate-200" />
      <SkeletonKpiStrip count={6} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    </div>
  )
}
