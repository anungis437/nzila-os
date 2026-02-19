/**
 * TierProgress — sidebar widget showing progress to next tier.
 */
import type { PartnerTier } from './TierBadge'
import { TierBadge } from './TierBadge'

interface TierProgressProps {
  currentTier: PartnerTier
  progress: number // 0-100
  nextTier: PartnerTier | null
  requirements: string[]
}

export function TierProgress({ currentTier, progress, nextTier, requirements }: TierProgressProps) {
  return (
    <div className="px-4 py-3 mx-3 mt-4 rounded-xl bg-blue-50 border border-blue-100">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-blue-800">Current Tier</p>
        <TierBadge tier={currentTier} />
      </div>

      {nextTier && (
        <>
          <div className="mt-3 h-1.5 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-blue-600 mt-1">
            {progress}% to {nextTier.charAt(0).toUpperCase() + nextTier.slice(1)} tier
          </p>

          {requirements.length > 0 && (
            <div className="mt-2 space-y-1">
              {requirements.map((req) => (
                <p key={req} className="text-[10px] text-blue-500 leading-tight">• {req}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
