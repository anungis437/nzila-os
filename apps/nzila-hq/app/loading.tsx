import { SkeletonKpiStrip, SkeletonCard } from '@/components/primitives/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-2 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-7 w-72 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-3 w-96 animate-pulse rounded bg-slate-100" />
      </div>
      <SkeletonKpiStrip />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SkeletonCard lines={6} />
        </div>
        <SkeletonCard lines={4} />
      </div>
    </div>
  )
}
