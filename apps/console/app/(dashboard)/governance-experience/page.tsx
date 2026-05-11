/**
 * Executive Governance Experience — Nzila ExecutiveOS Console
 *
 * Calm executive briefing surface. One screen, one truth per card.
 * No engineering jargon, no orchestration internals, no animation,
 * no real-time refresh. Reading load is bounded; the executive sets
 * the pace.
 *
 * Doctrine: docs/nzila-governance-experience/executive-governance-experience.md
 */
import { PageHeader } from '@/components/ui/PageHeader'
import {
  buildPostureCard,
  interpretBanding,
  type PostureBand,
  type PostureCard,
  type Verdict,
} from '@nzila/governance-operations'
import {
  buildContinuityReviewCard,
  stabilizationGuidanceFor,
  type ContinuityReviewCard,
} from '@nzila/continuity-review'
import {
  buildStabilizationReading,
  type StabilizationReading,
} from '@nzila/stabilization-signals'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Governance experience — ExecutiveOS',
  description: 'Calm executive briefing across products. Bounded reading. One decision per session.',
}

const NOW = '2026-05-09T07:00:00.000Z'

function bandClass(band: PostureBand): string {
  switch (band) {
    case 'stable':
      return 'text-emerald-700 border-emerald-200'
    case 'warming':
      return 'text-amber-700 border-amber-200'
    case 'concerning':
      return 'text-orange-700 border-orange-200'
    case 'destabilizing':
      return 'text-red-700 border-red-200'
  }
}

function verdictClass(verdict: Verdict): string {
  switch (verdict) {
    case 'verified':
      return 'text-emerald-700'
    case 'partial':
      return 'text-amber-700'
    case 'rejected':
      return 'text-red-700'
    case 'unknown':
      return 'text-gray-500'
  }
}

function postureCards(): readonly PostureCard[] {
  return [
    buildPostureCard({
      id: 'exec-posture-control-plane',
      surface: 'Overall posture',
      product: 'control-plane',
      banding: 'stable',
      trajectory: 'holding',
      interpretation: interpretBanding('stable'),
      doctrineCitations: [
        { document: 'docs/nzila-governance-experience/executive-governance-experience.md' },
      ],
      observedAt: NOW,
    }),
    buildPostureCard({
      id: 'exec-posture-union-eyes',
      surface: 'Pilot posture',
      product: 'union-eyes',
      banding: 'warming',
      trajectory: 'holding',
      interpretation: interpretBanding('warming'),
      doctrineCitations: [
        { document: 'docs/nzila-governance-experience/executive-governance-experience.md' },
      ],
      observedAt: NOW,
    }),
    buildPostureCard({
      id: 'exec-posture-platform',
      surface: 'Platform posture',
      product: 'platform',
      banding: 'stable',
      trajectory: 'stabilizing',
      interpretation: interpretBanding('stable'),
      doctrineCitations: [
        { document: 'docs/nzila-governance-experience/executive-governance-experience.md' },
      ],
      observedAt: NOW,
    }),
  ]
}

function continuityBriefing(): ContinuityReviewCard {
  return buildContinuityReviewCard({
    dimension: 'modernization-health',
    banding: 'stable',
    trajectory: 'stabilizing',
    scope: { kind: 'system', systemId: 'platform' },
    interpretation: 'Modernization is integrity-preserving on the current cadence.',
    stabilizationGuidance: stabilizationGuidanceFor('stable'),
    observedAt: NOW,
    windowMinutes: 60,
  })
}

function modernizationPacing(): StabilizationReading {
  return buildStabilizationReading({
    signal: 'modernization-pacing',
    banding: 'warming',
    observedAt: NOW,
    windowMinutes: 60,
    scope: { kind: 'system', systemId: 'platform' },
    interpretation: 'Modernization pacing is warming; coordinate the next rollout window.',
  })
}

function legitimacyVerdict(): { verdict: Verdict; release: string; environment: string; sentence: string } {
  return {
    verdict: 'verified',
    release: 'r-2026-05-09-1',
    environment: 'staging-canada',
    sentence: 'Latest release verified against the manifest and isolation invariants.',
  }
}

export default function ExecutiveGovernanceExperiencePage() {
  const posture = postureCards()
  const continuity = continuityBriefing()
  const pacing = modernizationPacing()
  const legitimacy = legitimacyVerdict()

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Governance experience"
        title="Executive briefing"
        description="One screen, one truth per card. Read sparsely; act deliberately. No urgency framing in routine surfaces."
      />

      <section aria-labelledby="exec-posture-heading" className="space-y-4">
        <h2
          id="exec-posture-heading"
          className="text-xs font-semibold uppercase tracking-widest text-gray-500"
        >
          Posture by product
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {posture.map((p) => (
            <article
              key={p.id}
              className={`rounded-lg border bg-white p-6 shadow-sm ${bandClass(p.banding)}`}
            >
              <header className="flex items-baseline justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">{p.product}</p>
                  <h3 className="text-base font-semibold text-gray-900">{p.surface}</h3>
                </div>
                <span className={`text-sm font-medium ${bandClass(p.banding)}`}>{p.banding}</span>
              </header>
              <p className="mt-4 text-sm leading-relaxed text-gray-700">{p.interpretation}</p>
              <p className="mt-4 text-xs text-gray-500">
                Observed {new Date(p.observedAt).toUTCString()}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="exec-continuity-heading" className="space-y-4">
        <h2
          id="exec-continuity-heading"
          className="text-xs font-semibold uppercase tracking-widest text-gray-500"
        >
          Continuity briefing
        </h2>
        <article className={`rounded-lg border bg-white p-6 shadow-sm ${bandClass(continuity.banding)}`}>
          <header className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {continuity.dimension}
              </p>
              <h3 className="text-base font-semibold text-gray-900">
                {continuity.scope.systemId}
              </h3>
            </div>
            <span className={`text-sm font-medium ${bandClass(continuity.banding)}`}>
              {continuity.banding}
            </span>
          </header>
          <p className="mt-4 text-sm leading-relaxed text-gray-700">{continuity.interpretation}</p>
          <p className="mt-3 text-sm leading-relaxed text-gray-500 italic">
            {continuity.stabilizationGuidance}
          </p>
        </article>
      </section>

      <section aria-labelledby="exec-pacing-heading" className="space-y-4">
        <h2
          id="exec-pacing-heading"
          className="text-xs font-semibold uppercase tracking-widest text-gray-500"
        >
          Modernization pacing
        </h2>
        <article className={`rounded-lg border bg-white p-6 shadow-sm ${bandClass(pacing.banding)}`}>
          <header className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">{pacing.signal}</p>
              <h3 className="text-base font-semibold text-gray-900">{pacing.scope.systemId}</h3>
            </div>
            <span className={`text-sm font-medium ${bandClass(pacing.banding)}`}>
              {pacing.banding}
            </span>
          </header>
          <p className="mt-4 text-sm leading-relaxed text-gray-700">{pacing.interpretation}</p>
          <p className="mt-3 text-sm leading-relaxed text-gray-500 italic">{pacing.advisory}</p>
        </article>
      </section>

      <section aria-labelledby="exec-legitimacy-heading" className="space-y-4">
        <h2
          id="exec-legitimacy-heading"
          className="text-xs font-semibold uppercase tracking-widest text-gray-500"
        >
          Latest deployment legitimacy
        </h2>
        <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <header className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {legitimacy.release}
              </p>
              <h3 className="text-base font-semibold text-gray-900">{legitimacy.environment}</h3>
            </div>
            <span className={`text-sm font-medium ${verdictClass(legitimacy.verdict)}`}>
              {legitimacy.verdict}
            </span>
          </header>
          <p className="mt-4 text-sm leading-relaxed text-gray-700">{legitimacy.sentence}</p>
        </article>
      </section>
    </div>
  )
}
