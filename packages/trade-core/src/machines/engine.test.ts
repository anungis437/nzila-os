/**
 * Tests for the Trade Deal FSM engine + machine definition.
 */
import { describe, it, expect } from 'vitest'
import { TradeDealStage, TradeOrgRole } from '../enums'
import {
  attemptDealTransition,
  getAvailableDealTransitions,
  validateDealMachine,
} from '../machines/engine'
import { tradeDealMachine } from '../machines/deal'

const ORG_ID = 'org-001'

function ctx(role: TradeOrgRole = TradeOrgRole.ADMIN) {
  return { orgId: ORG_ID, actorId: 'actor-001', role }
}

function deal(stage: TradeDealStage) {
  return { orgId: ORG_ID, stage }
}

describe('tradeDealMachine — structural validity', () => {
  it('passes machine validation with no errors', () => {
    const errors = validateDealMachine(tradeDealMachine)
    expect(errors).toEqual([])
  })

  it('has lead as initial state', () => {
    expect(tradeDealMachine.initialState).toBe(TradeDealStage.LEAD)
  })

  it('has closed and cancelled as terminal states', () => {
    expect(tradeDealMachine.terminalStates).toContain(TradeDealStage.CLOSED)
    expect(tradeDealMachine.terminalStates).toContain(TradeDealStage.CANCELLED)
  })
})

describe('attemptDealTransition — happy path', () => {
  it('transitions lead → qualified', () => {
    const result = attemptDealTransition(
      tradeDealMachine,
      ctx(TradeOrgRole.SELLER),
      deal(TradeDealStage.LEAD),
      TradeDealStage.QUALIFIED,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.from).toBe(TradeDealStage.LEAD)
      expect(result.to).toBe(TradeDealStage.QUALIFIED)
    }
  })

  it('transitions full pipeline end-to-end', () => {
    const stages: TradeDealStage[] = [
      TradeDealStage.QUALIFIED,
      TradeDealStage.QUOTED,
      TradeDealStage.ACCEPTED,
      TradeDealStage.FUNDED,
      TradeDealStage.SHIPPED,
      TradeDealStage.DELIVERED,
      TradeDealStage.CLOSED,
    ]
    let current: TradeDealStage = TradeDealStage.LEAD
    for (const next of stages) {
      const result = attemptDealTransition(
        tradeDealMachine,
        ctx(TradeOrgRole.ADMIN),
        deal(current),
        next,
      )
      expect(result.ok).toBe(true)
      current = next
    }
  })
})

describe('attemptDealTransition — blocked transitions', () => {
  it('blocks transition from terminal state', () => {
    const result = attemptDealTransition(
      tradeDealMachine,
      ctx(),
      deal(TradeDealStage.CLOSED),
      TradeDealStage.LEAD,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('TERMINAL_STATE')
  })

  it('blocks invalid transition (lead → shipped)', () => {
    const result = attemptDealTransition(
      tradeDealMachine,
      ctx(),
      deal(TradeDealStage.LEAD),
      TradeDealStage.SHIPPED,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('INVALID_TRANSITION')
  })

  it('blocks cross-org access', () => {
    const crossCtx = { orgId: 'other-org', actorId: 'actor-001', role: TradeOrgRole.ADMIN }
    const result = attemptDealTransition(
      tradeDealMachine,
      crossCtx,
      deal(TradeDealStage.LEAD),
      TradeDealStage.QUALIFIED,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('ORG_MISMATCH')
  })

  it('blocks unauthorized role (viewer cannot qualify)', () => {
    const result = attemptDealTransition(
      tradeDealMachine,
      ctx(TradeOrgRole.VIEWER),
      deal(TradeDealStage.LEAD),
      TradeDealStage.QUALIFIED,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('ROLE_DENIED')
  })

  it('blocks transition when a guard fails', () => {
    const guardedMachine = {
      ...tradeDealMachine,
      transitions: tradeDealMachine.transitions.map((t) =>
        t.from === TradeDealStage.LEAD && t.to === TradeDealStage.QUALIFIED
          ? { ...t, guards: [() => false] }
          : t,
      ),
    }

    const result = attemptDealTransition(
      guardedMachine,
      ctx(TradeOrgRole.ADMIN),
      deal(TradeDealStage.LEAD),
      TradeDealStage.QUALIFIED,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('GUARD_FAILED')
  })
})

describe('attemptDealTransition — evidence requirements', () => {
  it('requires evidence for quoted → accepted', () => {
    const result = attemptDealTransition(
      tradeDealMachine,
      ctx(TradeOrgRole.ADMIN),
      deal(TradeDealStage.QUOTED),
      TradeDealStage.ACCEPTED,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.evidenceRequired).toBe(true)
  })

  it('requires evidence for funded → shipped', () => {
    const result = attemptDealTransition(
      tradeDealMachine,
      ctx(TradeOrgRole.ADMIN),
      deal(TradeDealStage.FUNDED),
      TradeDealStage.SHIPPED,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.evidenceRequired).toBe(true)
  })

  it('requires evidence for delivered → closed', () => {
    const result = attemptDealTransition(
      tradeDealMachine,
      ctx(TradeOrgRole.ADMIN),
      deal(TradeDealStage.DELIVERED),
      TradeDealStage.CLOSED,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.evidenceRequired).toBe(true)
  })

  it('does not require evidence for lead → qualified', () => {
    const result = attemptDealTransition(
      tradeDealMachine,
      ctx(TradeOrgRole.ADMIN),
      deal(TradeDealStage.LEAD),
      TradeDealStage.QUALIFIED,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.evidenceRequired).toBe(false)
  })
})

describe('getAvailableDealTransitions', () => {
  it('returns transitions for lead stage as admin', () => {
    const transitions = getAvailableDealTransitions(
      tradeDealMachine,
      ctx(TradeOrgRole.ADMIN),
      deal(TradeDealStage.LEAD),
    )
    expect(transitions.length).toBeGreaterThan(0)
    expect(transitions.some((t) => t.to === TradeDealStage.QUALIFIED)).toBe(true)
  })

  it('returns empty for terminal state', () => {
    const transitions = getAvailableDealTransitions(
      tradeDealMachine,
      ctx(),
      deal(TradeDealStage.CLOSED),
    )
    expect(transitions).toEqual([])
  })

  it('returns empty for cross-org', () => {
    const crossCtx = { orgId: 'other-org', actorId: 'actor-001', role: TradeOrgRole.ADMIN }
    const transitions = getAvailableDealTransitions(
      tradeDealMachine,
      crossCtx,
      deal(TradeDealStage.LEAD),
    )
    expect(transitions).toEqual([])
  })
})

describe('validateDealMachine — invalid structures', () => {
  it('reports invalid initial, terminal, and transition states', () => {
    const invalidMachine = {
      ...tradeDealMachine,
      initialState: 'missing_initial' as TradeDealStage,
      terminalStates: [...tradeDealMachine.terminalStates, 'missing_terminal' as TradeDealStage],
      transitions: [
        ...tradeDealMachine.transitions,
        {
          ...tradeDealMachine.transitions[0],
          from: 'missing_from' as TradeDealStage,
          to: 'missing_to' as TradeDealStage,
        },
      ],
    }

    const errors = validateDealMachine(invalidMachine)
    expect(errors.some((e) => e.includes('Initial state'))).toBe(true)
    expect(errors.some((e) => e.includes('Terminal state'))).toBe(true)
    expect(errors.some((e) => e.includes("Transition from 'missing_from'"))).toBe(true)
    expect(errors.some((e) => e.includes("Transition to 'missing_to'"))).toBe(true)
  })

  it('reports unreachable dead states', () => {
    const unreachableMachine = {
      ...tradeDealMachine,
      transitions: tradeDealMachine.transitions.filter((t) => t.to !== TradeDealStage.DELIVERED),
    }

    const errors = validateDealMachine(unreachableMachine)
    expect(errors.some((e) => e.includes("State 'delivered' is unreachable"))).toBe(true)
  })
})
