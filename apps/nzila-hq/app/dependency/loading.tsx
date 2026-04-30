import { SkeletonCard, SkeletonTable } from '@/components/primitives/Skeleton'
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-7 w-72 animate-pulse rounded bg-slate-200" />
      <SkeletonCard lines={3} />
      <SkeletonTable rows={6} cols={4} />
    </div>
  )
}
