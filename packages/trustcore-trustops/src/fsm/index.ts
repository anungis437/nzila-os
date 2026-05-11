import {
  TRUSTOPS_FORWARD_EDGES,
  TRUSTOPS_MANDATE_STAGES,
  TrustOpsTransitionInputSchema,
  type TrustOpsMandateStage,
  type TrustOpsTransitionInput,
} from '@nzila/trustcore-contracts'

/**
 * Terminal stages — once entered, a mandate cannot transition further
 * through the standard forward FSM. Withdrawal/rejection paths are
 * represented as separate, explicit terminal events outside this table.
 */
export const TRUSTOPS_TERMINAL_STAGES = ['archived'] as const
export type TrustOpsTerminalStage = (typeof TRUSTOPS_TERMINAL_STAGES)[number]

/** Map of fromStage → allowed toStages (forward + reverse single-step
 * "rollback" allowed for correction within an investigation). */
function buildAdjacency(): Map<TrustOpsMandateStage, ReadonlySet<TrustOpsMandateStage>> {
  const map = new Map<TrustOpsMandateStage, Set<TrustOpsMandateStage>>()
  for (const s of TRUSTOPS_MANDATE_STAGES) map.set(s, new Set())
  for (const [from, to] of TRUSTOPS_FORWARD_EDGES) {
    map.get(from)!.add(to)
    // Allow single-step rollback (auditable).
    map.get(to)!.add(from)
  }
  return map as Map<TrustOpsMandateStage, ReadonlySet<TrustOpsMandateStage>>
}

const ADJACENCY = buildAdjacency()

export interface TransitionAttemptResult {
  ok: boolean
  /** Reason code when ok=false. */
  reason?:
    | 'invalid_input'
    | 'terminal_from_stage'
    | 'edge_not_allowed'
    | 'identity_transition'
}

/**
 * Validate an attempted FSM transition WITHOUT mutating any state. Pure.
 * Does not depend on persistence — callers compose this with their own
 * read-then-write logic and audit emission.
 */
export function evaluateTransition(input: unknown): TransitionAttemptResult {
  const parsed = TrustOpsTransitionInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid_input' }
  const { fromStage, toStage } = parsed.data
  if (fromStage === toStage) return { ok: false, reason: 'identity_transition' }
  if ((TRUSTOPS_TERMINAL_STAGES as readonly string[]).includes(fromStage)) {
    return { ok: false, reason: 'terminal_from_stage' }
  }
  // ADJACENCY is preloaded for every TRUSTOPS_MANDATE_STAGES value, and
  // zod has already validated fromStage as a member of that enum, so
  // ADJACENCY.get(fromStage) is guaranteed to return a Set here.
  const allowed = ADJACENCY.get(fromStage)!
  if (!allowed.has(toStage)) return { ok: false, reason: 'edge_not_allowed' }
  return { ok: true }
}

/** Convenience type-narrowing helper for callers that already have a
 * validated input from elsewhere in the pipeline. */
export function isTransitionAllowed(
  input: TrustOpsTransitionInput,
): boolean {
  return evaluateTransition(input).ok
}

/** Returns the set of stages reachable in one step from `from`. */
export function nextStages(from: TrustOpsMandateStage): ReadonlyArray<TrustOpsMandateStage> {
  return Array.from(ADJACENCY.get(from) ?? [])
}

export function isTerminalStage(stage: TrustOpsMandateStage): boolean {
  return (TRUSTOPS_TERMINAL_STAGES as readonly string[]).includes(stage)
}
