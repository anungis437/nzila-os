import {
  buildLegitimacySummary,
  type AttestationEnvelopeProjection,
} from '@nzila/attestation-visibility'
import { CalmCard, VerdictLabel } from './primitives'

interface AttestationPanelProps {
  readonly attestation: AttestationEnvelopeProjection
}

/**
 * Renders an attestation projection. Verdict is rendered as text first,
 * colour second. Cited evidence and content hash are always visible.
 * Refuses to silently downgrade `rejected`.
 */
export function AttestationPanel({ attestation }: AttestationPanelProps) {
  return (
    <CalmCard>
      <header className="flex items-baseline justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {attestation.class}
          </p>
          <h3 className="text-base font-semibold text-card-foreground">
            {attestation.releaseId ?? attestation.environmentId ?? 'Attestation'}
          </h3>
        </div>
        <VerdictLabel verdict={attestation.verdict} />
      </header>
      <p className="mt-4 text-sm leading-relaxed text-card-foreground">{attestation.interpretation}</p>
      <dl className="mt-6 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Issuer</dt>
          <dd>{attestation.issuer}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Issued at</dt>
          <dd>{new Date(attestation.issuedAt).toUTCString()}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-foreground">Content hash</dt>
          <dd className="font-mono break-all">{attestation.contentHash}</dd>
        </div>
        {attestation.supersedes ? (
          <div className="sm:col-span-2">
            <dt className="font-medium text-foreground">Supersedes</dt>
            <dd className="font-mono break-all">{attestation.supersedes}</dd>
          </div>
        ) : null}
        {attestation.citedEvidence.length > 0 ? (
          <div className="sm:col-span-2">
            <dt className="font-medium text-foreground">Cited evidence</dt>
            <dd>
              <ul className="mt-1 space-y-1">
                {attestation.citedEvidence.map((e) => (
                  <li key={e.contentHash} className="font-mono">
                    {e.kind} · {e.contentHash}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
    </CalmCard>
  )
}

interface LegitimacySummaryCardProps {
  readonly attestation: AttestationEnvelopeProjection
}

export function LegitimacySummaryCard({ attestation }: LegitimacySummaryCardProps) {
  const summary = buildLegitimacySummary(attestation)
  return (
    <CalmCard>
      <header className="flex items-baseline justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Deployment legitimacy
          </p>
          <h3 className="text-base font-semibold text-card-foreground">
            {summary.releaseId} → {summary.environmentId}
          </h3>
        </div>
        <VerdictLabel verdict={summary.verdict} />
      </header>
      <p className="mt-4 text-sm leading-relaxed text-card-foreground">{summary.interpretation}</p>
      <p className="mt-4 text-xs font-mono text-muted-foreground break-all">
        {summary.attestationContentHash}
      </p>
    </CalmCard>
  )
}
