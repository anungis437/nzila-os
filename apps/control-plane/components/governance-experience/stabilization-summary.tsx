import type { StabilizationReading } from '@nzila/stabilization-signals'
import { BandingLabel, CalmCard } from './primitives'

interface StabilizationSummaryProps {
  readonly reading: StabilizationReading
}

export function StabilizationSummary({ reading }: StabilizationSummaryProps) {
  return (
    <CalmCard band={reading.banding}>
      <header className="flex items-baseline justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Stabilization · {reading.signal}
          </p>
          <h3 className="text-base font-semibold text-card-foreground">
            {reading.scope.systemId}
          </h3>
        </div>
        <BandingLabel band={reading.banding} />
      </header>
      <p className="mt-4 text-sm leading-relaxed text-card-foreground">{reading.interpretation}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground italic">{reading.advisory}</p>
      <footer className="mt-6 text-xs text-muted-foreground">
        Window: {reading.windowMinutes}m · Observed {new Date(reading.observedAt).toUTCString()}
      </footer>
    </CalmCard>
  )
}
