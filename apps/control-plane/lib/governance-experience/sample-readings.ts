/**
 * Sample governance experience readings.
 *
 * These are calm seed readings used by the governance-experience pages
 * until live attestation/operations sources are wired in. They are
 * deliberately sparse and conservative — most bandings read `forming`
 * or `stable`, matching the standing readiness review.
 *
 * Replace with live readers (governance-otel + runtime-attestation
 * ledger queries) without changing the page layouts.
 */
import {
  buildPostureCard,
  buildTimelineEntry,
  type PostureCard,
  type TimelineEntry,
} from '@nzila/governance-operations'
import {
  buildContinuityReviewCard,
  stabilizationGuidanceFor,
  type ContinuityReviewCard,
} from '@nzila/continuity-review'
import {
  projectAttestationForView,
  type AttestationEnvelopeProjection,
} from '@nzila/attestation-visibility'
import {
  buildStabilizationReading,
  type StabilizationReading,
} from '@nzila/stabilization-signals'
import {
  DecisionLedger,
  type ReviewDecision,
} from '@nzila/governance-review'

const NOW = '2026-05-09T07:00:00.000Z'

function postureCards(): readonly PostureCard[] {
  return [
    buildPostureCard({
      id: 'posture-control-plane-overall',
      surface: 'Overall posture',
      product: 'control-plane',
      banding: 'stable',
      trajectory: 'holding',
      interpretation: 'Posture is stable; no governance interventions outstanding.',
      doctrineCitations: [
        { document: 'docs/nzila-governance-operations/governance-operations-dashboard-system.md' },
      ],
      observedAt: NOW,
    }),
    buildPostureCard({
      id: 'posture-union-eyes-overall',
      surface: 'Overall posture',
      product: 'union-eyes',
      banding: 'warming',
      trajectory: 'holding',
      interpretation:
        'Posture is warming on the pilot corridor; monitor on the next slow refresh.',
      doctrineCitations: [
        { document: 'docs/nzila-governance-operations/governance-operations-dashboard-system.md' },
      ],
      observedAt: NOW,
    }),
    buildPostureCard({
      id: 'posture-console-overall',
      surface: 'Executive surfaces',
      product: 'console',
      banding: 'stable',
      trajectory: 'holding',
      interpretation: 'Executive surfaces are stable; reading load is within bounds.',
      doctrineCitations: [
        { document: 'docs/nzila-governance-experience/executive-governance-experience.md' },
      ],
      observedAt: NOW,
    }),
  ]
}

function continuityCards(): readonly ContinuityReviewCard[] {
  return [
    buildContinuityReviewCard({
      dimension: 'fragmentation',
      banding: 'warming',
      trajectory: 'drifting',
      scope: { kind: 'system', systemId: 'union-eyes-pilot' },
      interpretation: 'Fragmentation is warming across the rollout corridor.',
      stabilizationGuidance: stabilizationGuidanceFor('warming'),
      observedAt: NOW,
      windowMinutes: 60,
    }),
    buildContinuityReviewCard({
      dimension: 'coordination-stabilization',
      banding: 'stable',
      trajectory: 'holding',
      scope: { kind: 'system', systemId: 'control-plane' },
      interpretation: 'Coordination across orchestration boundaries is stable.',
      stabilizationGuidance: stabilizationGuidanceFor('stable'),
      observedAt: NOW,
      windowMinutes: 60,
    }),
    buildContinuityReviewCard({
      dimension: 'modernization-health',
      banding: 'stable',
      trajectory: 'stabilizing',
      scope: { kind: 'system', systemId: 'platform' },
      interpretation: 'Modernization pacing is integrity-preserving on the current cadence.',
      stabilizationGuidance: stabilizationGuidanceFor('stable'),
      observedAt: NOW,
      windowMinutes: 60,
    }),
  ]
}

function attestations(): readonly AttestationEnvelopeProjection[] {
  return [
    projectAttestationForView({
      contentHash: 'sha256:1f3a2c8b9e7d4a5b6c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
      class: 'release',
      verdict: 'verified',
      issuedAt: NOW,
      issuer: 'gitops-deploy@nzila',
      releaseId: 'r-2026-05-09-1',
      environmentId: 'staging-canada',
      citedEvidence: [
        {
          kind: 'deployment-log',
          contentHash: 'sha256:c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1',
        },
      ],
      interpretation: 'Verified against the manifest and isolation invariants.',
      accessClass: 'governance-forum',
    }),
    projectAttestationForView({
      contentHash: 'sha256:2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b',
      class: 'deployment-legitimacy',
      verdict: 'partial',
      issuedAt: NOW,
      issuer: 'gitops-deploy@nzila',
      releaseId: 'r-2026-05-09-1',
      environmentId: 'staging-canada',
      citedEvidence: [],
      interpretation:
        'Partially verified; topology drift detected against the manifest topology.',
      accessClass: 'governance-forum',
    }),
  ]
}

function stabilization(): readonly StabilizationReading[] {
  return [
    buildStabilizationReading({
      signal: 'operational-calmness',
      banding: 'stable',
      observedAt: NOW,
      windowMinutes: 60,
      scope: { kind: 'system', systemId: 'control-plane' },
      interpretation: 'Operational calmness is stable across the observation window.',
    }),
    buildStabilizationReading({
      signal: 'modernization-pacing',
      banding: 'warming',
      observedAt: NOW,
      windowMinutes: 60,
      scope: { kind: 'system', systemId: 'platform' },
      interpretation: 'Modernization pacing is warming; coordinate the next rollout window.',
    }),
    buildStabilizationReading({
      signal: 'deployment-confidence',
      banding: 'stable',
      observedAt: NOW,
      windowMinutes: 60,
      scope: { kind: 'system', systemId: 'control-plane' },
      interpretation: 'Deployment confidence is stable across the last validated releases.',
    }),
  ]
}

function timeline(): readonly TimelineEntry[] {
  return [
    buildTimelineEntry({
      id: 'evt-1',
      occurredAt: NOW,
      eventType: 'release_attestation_recorded',
      severity: 'info',
      summary: 'Release r-2026-05-09-1 attestation recorded.',
      doctrineDocument: 'docs/nzila-runtime-integration/live-runtime-attestation-generation.md',
      contentHash: 'sha256:1f3a2c8b9e7d4a5b6c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    }),
    buildTimelineEntry({
      id: 'evt-2',
      occurredAt: '2026-05-09T05:30:00.000Z',
      eventType: 'doctrine_enforcement_event',
      severity: 'warning',
      summary: 'Pilot isolation enforced; cross-tenant route attempt denied.',
      doctrineDocument: 'docs/nzila-runtime-integration/runtime-doctrine-enforcement.md',
    }),
    buildTimelineEntry({
      id: 'evt-3',
      occurredAt: '2026-05-09T03:15:00.000Z',
      eventType: 'continuity_observation',
      severity: 'info',
      summary: 'Continuity posture warming on union-eyes pilot corridor.',
      doctrineDocument: 'docs/nzila-runtime-integration/continuity-observability-runtime-embedding.md',
    }),
  ]
}

function decisions(): readonly ReviewDecision[] {
  const ledger = new DecisionLedger()
  ledger.record({
    id: 'd-2026-05-08-1',
    workflow: 'deployment-review',
    decision: 'acknowledge',
    decidedAt: '2026-05-08T16:00:00.000Z',
    reviewerRole: 'governance-officer',
    citedDoctrine: ['docs/nzila-governance-operations/executive-governance-review-workflows.md'],
    rationale: 'Routine acknowledgement of staging deployment under standard cadence.',
  })
  ledger.record({
    id: 'd-2026-05-09-1',
    workflow: 'continuity-review',
    decision: 'request_clarification',
    decidedAt: '2026-05-09T06:00:00.000Z',
    reviewerRole: 'governance-officer',
    citedDoctrine: ['docs/nzila-governance-operations/continuity-posture-review-system.md'],
    rationale:
      'Fragmentation banding warmed on union-eyes pilot; request continuity narrative on next cadence.',
  })
  return ledger.list()
}

export function getGovernanceExperienceReadings() {
  return {
    postureCards: postureCards(),
    continuityCards: continuityCards(),
    attestations: attestations(),
    stabilization: stabilization(),
    timeline: timeline(),
    decisions: decisions(),
    observedAt: NOW,
  }
}
