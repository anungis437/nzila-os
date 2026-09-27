/**
 * TREASURER → NORTHSTAR interface.
 * TREASURER reports capital capacity. It does not decide whether a dream should exist.
 * NORTHSTAR cannot fabricate financial capacity through this interface.
 */
import { fail, ok, type EpistemicClass, type Result } from './kernel'
import { committedCapitalMinor } from './decision'
import type { CapitalEnvelope, DecisionCase, NorthstarAmbition, PortfolioSnapshot, Scenario } from './schemas'
import { acceptScenarioForDecision, applyScenario } from './calculations'

export interface NorthstarCapitalReport {
  readonly availableDeployableCapitalMinor: number | null
  readonly availableDeployableClass: EpistemicClass | 'UNKNOWN'
  readonly committedCapitalMinor: number | null
  readonly committedCapitalClass: EpistemicClass | 'UNKNOWN'
  readonly liquidityFloorMinor: number | null
  readonly trajectories: readonly {
    readonly scenarioId: string
    readonly endMinor: number
    readonly epistemicClass: 'SCENARIO'
  }[]
  readonly ambitionFundingGaps: readonly {
    readonly ambitionId: string
    readonly gapMinor: number | null
    readonly status: 'GAP' | 'COVERED' | 'UNKNOWN'
  }[]
  readonly milestones: readonly { readonly id: string; readonly note: string }[]
  readonly risks: readonly string[]
  readonly dreamExistenceDecision: 'NOT_TREASURER_AUTHORITY'
  readonly failClosedReasons: readonly string[]
}

export function decideDreamShouldExist(): Result<never> {
  return fail('DREAM_DECISION_OUT_OF_SCOPE', 'TREASURER does not decide whether a dream should exist')
}

export function capacityFromNorthstarAmbition(_ambition: NorthstarAmbition): Result<never> {
  return fail(
    'NORTHSTAR_CANNOT_FABRICATE_CAPACITY',
    'NORTHSTAR cannot independently fabricate financial capacity',
  )
}

export function reportToNorthstar(input: {
  readonly snapshot: PortfolioSnapshot | null
  readonly snapshotIsFreshFact: boolean
  readonly liquidityFloorMinor: number | null
  readonly decisions: readonly DecisionCase[]
  readonly envelopes: readonly CapitalEnvelope[]
  readonly ambitions: readonly NorthstarAmbition[]
  readonly scenarios: readonly Scenario[]
  readonly milestones?: readonly { readonly id: string; readonly note: string }[]
}): Result<NorthstarCapitalReport> {
  const reasons: string[] = []
  const risks: string[] = []
  for (const envelope of input.envelopes) {
    if (envelope.investmentAuthorized || envelope.committedMinor !== 0 || envelope.transactionExecuted) {
      return fail('ENVELOPE_IS_NOT_COMMITTED_CAPITAL', 'envelope leaked into committed capital')
    }
  }
  let committed: number | null = null
  let committedClass: EpistemicClass | 'UNKNOWN' = 'UNKNOWN'
  if (input.snapshot) {
    const sum = committedCapitalMinor(input.decisions, input.snapshot.baseCurrency)
    if (!sum.ok) {
      reasons.push(sum.reason)
    } else {
      committed = sum.value
      committedClass = 'DECISION'
    }
  } else {
    reasons.push('no personal snapshot; committed capital is unknown')
  }

  let available: number | null = null
  let availableClass: EpistemicClass | 'UNKNOWN' = 'UNKNOWN'
  if (!input.snapshot || !input.snapshotIsFreshFact || input.liquidityFloorMinor === null || committed === null) {
    reasons.push('deployable capital is unknown without fresh FACT cash, a liquidity floor, and committed capital')
    risks.push('capacity withheld because evidence is missing')
  } else {
    available = input.snapshot.cashMinor - input.liquidityFloorMinor - committed
    if (available < 0) {
      risks.push('liquidity floor and commitments exceed cash')
      available = 0
    }
    availableClass = 'FACT'
  }

  const trajectories: NorthstarCapitalReport['trajectories'][number][] = []
  for (const scenario of input.scenarios) {
    const accepted = acceptScenarioForDecision(scenario)
    if (!accepted.ok) {
      reasons.push(accepted.reason)
      continue
    }
    if (!input.snapshot || available === null) continue
    const applied = applyScenario(input.snapshot.cashMinor, accepted.value)
    if (!applied.ok) {
      reasons.push(applied.reason)
      continue
    }
    trajectories.push({
      scenarioId: accepted.value.id,
      endMinor: applied.value.endMinor,
      epistemicClass: 'SCENARIO',
    })
  }

  const gaps = input.ambitions.map((ambition) => {
    if (available === null || ambition.currency !== input.snapshot?.baseCurrency) {
      return { ambitionId: ambition.id, gapMinor: null, status: 'UNKNOWN' as const }
    }
    const gap = ambition.fundingNeedMinor - available
    return {
      ambitionId: ambition.id,
      gapMinor: gap > 0 ? gap : 0,
      status: gap > 0 ? ('GAP' as const) : ('COVERED' as const),
    }
  })

  if (input.envelopes.some((envelope) => envelope.releasedMinor > 0)) {
    risks.push('released envelope capacity is planning authority and is excluded from deployable and committed capital')
  }

  return ok({
    availableDeployableCapitalMinor: available,
    availableDeployableClass: availableClass,
    committedCapitalMinor: committed,
    committedCapitalClass: committedClass,
    liquidityFloorMinor: input.liquidityFloorMinor,
    trajectories,
    ambitionFundingGaps: gaps,
    milestones: input.milestones ?? [],
    risks,
    dreamExistenceDecision: 'NOT_TREASURER_AUTHORITY',
    failClosedReasons: reasons,
  })
}
