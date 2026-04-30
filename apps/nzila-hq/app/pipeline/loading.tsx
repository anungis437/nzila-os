import { SkeletonKpiStrip, SkeletonTable } from '@/components/primitives/Skeleton'
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-7 w-64 animate-pulse rounded bg-slate-200" />
      <SkeletonKpiStrip count={4} />
      <SkeletonTable rows={6} cols={6} />
    </div>
  )
}
