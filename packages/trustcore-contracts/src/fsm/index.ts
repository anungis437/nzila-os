import { z } from 'zod'

/**
 * TrustOps mandate FSM stages (linear with explicit jumps for
 * withdrawal / rejection handled separately by transition contracts).
 *
 * Source: plan.md Phase 1.3 — TrustOps mandate lifecycle.
 */
export const TRUSTOPS_MANDATE_STAGES = [
  'mandate_intake',
  'engagement_signed',
  'asset_inventory',
  'creditor_list_published',
  'proofs_of_claim_collection',
  'claims_classification',
  'restructuring_plan_drafted',
  'stakeholder_review',
  'court_filing',
  'distribution',
  'discharge',
  'archived',
] as const

export const TrustOpsMandateStageSchema = z.enum(TRUSTOPS_MANDATE_STAGES)
export type TrustOpsMandateStage = z.infer<typeof TrustOpsMandateStageSchema>

export const TrustOpsTransitionTriggerSchema = z.enum([
  'manual',
  'automatic',
  'deadline',
  'approval',
  'rejection',
])
export type TrustOpsTransitionTrigger = z.infer<typeof TrustOpsTransitionTriggerSchema>

/** Pure contract describing an attempted FSM transition (input). */
export const TrustOpsTransitionInputSchema = z.object({
  mandateId: z.string().uuid(),
  fromStage: TrustOpsMandateStageSchema,
  toStage: TrustOpsMandateStageSchema,
  trigger: TrustOpsTransitionTriggerSchema,
  reason: z.string().min(1).max(2000).optional(),
  actorUserId: z.string().min(1),
  occurredAt: z.string().datetime().optional(),
})
export type TrustOpsTransitionInput = z.infer<typeof TrustOpsTransitionInputSchema>

/** Allowed forward stage edges (deterministic — pure data). */
export const TRUSTOPS_FORWARD_EDGES: ReadonlyArray<
  readonly [TrustOpsMandateStage, TrustOpsMandateStage]
> = [
  ['mandate_intake', 'engagement_signed'],
  ['engagement_signed', 'asset_inventory'],
  ['asset_inventory', 'creditor_list_published'],
  ['creditor_list_published', 'proofs_of_claim_collection'],
  ['proofs_of_claim_collection', 'claims_classification'],
  ['claims_classification', 'restructuring_plan_drafted'],
  ['restructuring_plan_drafted', 'stakeholder_review'],
  ['stakeholder_review', 'court_filing'],
  ['court_filing', 'distribution'],
  ['distribution', 'discharge'],
  ['discharge', 'archived'],
]
