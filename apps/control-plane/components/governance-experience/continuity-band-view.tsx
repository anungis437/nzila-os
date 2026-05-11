import type { ContinuityReviewCard } from '@nzila/continuity-review'
import { BandingLabel, CalmCard } from './primitives'

interface ContinuityBandViewProps {
  readonly card: ContinuityReviewCard
}

export function ContinuityBandView({ card }: ContinuityBandViewProps) {
  return (
    <CalmCard band={card.banding}>
      <header className="flex items-baseline justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Continuity · {card.dimension}
          </p>
          <h3 className="text-base font-semibold text-card-foreground">
            {card.scope.systemId}
          </h3>
        </div>
        <BandingLabel band={card.banding} />
      </header>
      <p className="mt-4 text-sm leading-relaxed text-card-foreground">{card.interpretation}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground italic">
        {card.stabilizationGuidance}
      </p>
      <footer className="mt-6 text-xs text-muted-foreground">
        Trajectory: {card.trajectory} · Window: {card.windowMinutes}m · Observed{' '}
        {new Date(card.observedAt).toUTCString()}
      </footer>
    </CalmCard>
  )
}
