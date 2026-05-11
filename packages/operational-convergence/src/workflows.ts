/**
 * Cross-App Review Workflow Fabric
 *
 * Doctrine: docs/nzila-operational-convergence/cross-app-review-workflow-fabric.md
 */

export const CANONICAL_REVIEW_WORKFLOWS = [
  'governance-posture-review',
  'rollout-review',
  'continuity-review',
  'deployment-review',
  'attestation-review',
  'stabilization-review',
  'onboarding-review',
  'operational-readiness-review',
] as const
export type CanonicalReviewWorkflow = (typeof CANONICAL_REVIEW_WORKFLOWS)[number]

export const CANONICAL_REVIEW_DECISIONS = [
  'acknowledge',
  'request_clarification',
  'approve_with_conditions',
  'reject',
] as const
export type CanonicalReviewDecision = (typeof CANONICAL_REVIEW_DECISIONS)[number]

export interface WorkflowContract {
  readonly workflow: CanonicalReviewWorkflow
  readonly decisions: readonly CanonicalReviewDecision[]
  readonly requiredCitation: string
}

const WORKFLOW_CONTRACTS: Readonly<Record<CanonicalReviewWorkflow, WorkflowContract>> = {
  'governance-posture-review': {
    workflow: 'governance-posture-review',
    decisions: ['acknowledge', 'approve_with_conditions'],
    requiredCitation: 'docs/nzila-governance-experience/governance-review-experience.md',
  },
  'rollout-review': {
    workflow: 'rollout-review',
    decisions: ['acknowledge', 'approve_with_conditions', 'reject'],
    requiredCitation: 'docs/nzila-governance-operations/rollout-governance.md',
  },
  'continuity-review': {
    workflow: 'continuity-review',
    decisions: ['acknowledge', 'request_clarification'],
    requiredCitation: 'docs/nzila-governance-experience/continuity-posture-experience.md',
  },
  'deployment-review': {
    workflow: 'deployment-review',
    decisions: ['acknowledge', 'approve_with_conditions', 'reject'],
    requiredCitation: 'docs/nzila-governance-experience/deployment-legitimacy-experience.md',
  },
  'attestation-review': {
    workflow: 'attestation-review',
    decisions: ['acknowledge', 'request_clarification'],
    requiredCitation: 'docs/nzila-runtime-integration/live-runtime-attestation-generation.md',
  },
  'stabilization-review': {
    workflow: 'stabilization-review',
    decisions: ['acknowledge', 'approve_with_conditions'],
    requiredCitation: 'docs/nzila-operational-convergence/shared-stabilization-ux-system.md',
  },
  'onboarding-review': {
    workflow: 'onboarding-review',
    decisions: ['acknowledge', 'request_clarification'],
    requiredCitation: 'docs/nzila-operational-convergence/operator-journey-consistency.md',
  },
  'operational-readiness-review': {
    workflow: 'operational-readiness-review',
    decisions: ['acknowledge', 'approve_with_conditions', 'reject'],
    requiredCitation: 'docs/nzila-operational-convergence/canonical-operational-architecture.md',
  },
}

export function workflowContract(workflow: CanonicalReviewWorkflow): WorkflowContract {
  return WORKFLOW_CONTRACTS[workflow]
}
