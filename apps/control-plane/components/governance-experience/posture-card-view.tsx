import { interpretBanding, type PostureCard } from '@nzila/governance-operations'
import { BandingLabel, CalmCard } from './primitives'

interface PostureCardViewProps {
  readonly card: PostureCard
}

/**
 * Renders a single posture card as institutional reading material.
 * One truth per card — the banded reading, the calm interpretation,
 * the doctrine citation, the observation timestamp.
 */
export function PostureCardView({ card }: PostureCardViewProps) {
  const interpretation = card.interpretation || interpretBanding(card.banding)
  return (
    <CalmCard band={card.banding}>
      <header className="flex items-baseline justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {card.product}
          </p>
          <h3 className="text-base font-semibold text-card-foreground">{card.surface}</h3>
        </div>
        <BandingLabel band={card.banding} />
      </header>
      <p className="mt-4 text-sm leading-relaxed text-card-foreground">{interpretation}</p>
      <footer className="mt-6 space-y-1 text-xs text-muted-foreground">
        <p>Observed at {new Date(card.observedAt).toUTCString()}</p>
        <p>
          Doctrine:{' '}
          {card.doctrineCitations
            .map((c) => (c.section ? `${c.document} §${c.section}` : c.document))
            .join(' · ')}
        </p>
        {card.trajectory ? <p>Trajectory: {card.trajectory}</p> : null}
      </footer>
    </CalmCard>
  )
}
