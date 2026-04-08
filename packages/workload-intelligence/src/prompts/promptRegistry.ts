// ─── NIL Prompt Registry ─────────────────────────────────────────
// Two prompt families:
//   1. Intake-level: assess member submissions before rep review
//   2. Case-level: prioritize official work items in rep queues

import type { IntelligenceRequest } from '@nzila/intelligence'

// ─── Prompt Family Constants ─────────────────────────────────────

export const IntakePromptFamilies = {
  ASSESS_INTAKE_URGENCY: { family: 'assess_intake_urgency', version: '1.0.0' },
  SUMMARIZE_MEMBER_SUBMISSION: { family: 'summarize_member_submission', version: '1.0.0' },
  DETECT_MISSING_INTAKE_INFO: { family: 'detect_missing_intake_information', version: '1.0.0' },
  RECOMMEND_REP_REVIEW_TIMING: { family: 'recommend_rep_review_timing', version: '1.0.0' },
} as const

export const CasePromptFamilies = {
  PRIORITIZE_WORKLOAD_ITEM: { family: 'prioritize_workload_item', version: '1.0.0' },
  RANK_DAILY_WORK_QUEUE: { family: 'rank_daily_work_queue', version: '1.0.0' },
  EXPLAIN_PRIORITY_CHANGE: { family: 'explain_priority_change', version: '1.0.0' },
  DETECT_OVERLOAD_RISK: { family: 'detect_overload_risk', version: '1.0.0' },
  RECOMMEND_NEXT_ACTION: { family: 'recommend_next_action', version: '1.0.0' },
} as const

export type PromptFamily =
  | (typeof IntakePromptFamilies)[keyof typeof IntakePromptFamilies]
  | (typeof CasePromptFamilies)[keyof typeof CasePromptFamilies]

// ─── Prompt Request Builder ──────────────────────────────────────

export interface PromptRequest {
  readonly family: PromptFamily
  readonly orgId: string
  readonly input: Record<string, unknown>
}

export interface PromptRegistry {
  buildRequest(prompt: PromptRequest): IntelligenceRequest
  isIntakeFamily(useCase: string): boolean
  isCaseFamily(useCase: string): boolean
}

const INTAKE_USE_CASES = new Set<string>(
  Object.values(IntakePromptFamilies).map((f) => f.family),
)
const CASE_USE_CASES = new Set<string>(
  Object.values(CasePromptFamilies).map((f) => f.family),
)

/**
 * Create a prompt registry that maps WIL prompt families to NIL IntelligenceRequests.
 */
export function createPromptRegistry(): PromptRegistry {
  return {
    buildRequest(prompt: PromptRequest): IntelligenceRequest {
      return {
        orgId: prompt.orgId,
        app: 'ue',
        useCase: prompt.family.family,
        input: { ...prompt.input, promptVersion: prompt.family.version },
      }
    },

    isIntakeFamily(useCase: string): boolean {
      return INTAKE_USE_CASES.has(useCase)
    },

    isCaseFamily(useCase: string): boolean {
      return CASE_USE_CASES.has(useCase)
    },
  }
}
