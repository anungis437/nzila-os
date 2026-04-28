import { SkeletonCard } from '@/components/primitives/Skeleton'
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-72 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    </div>
  )
}
