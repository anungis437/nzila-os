import { SkeletonCard } from '@/components/primitives/Skeleton'
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
      <SkeletonCard lines={4} />
      <SkeletonCard lines={4} />
    </div>
  )
}
