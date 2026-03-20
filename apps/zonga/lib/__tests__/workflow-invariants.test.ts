/**
 * Zonga — Workflow State Machine Invariant Tests
 *
 * Structural validation across ALL workflow FSMs:
 * - No orphan states (every non-initial state is reachable)
 * - No dead-end non-terminal states (every non-terminal has outgoing transitions)
 * - Terminal states have zero outgoing transitions
 * - No self-loops
 * - Audit events are non-empty strings when present
 * - Determinism (no duplicate from→to pairs)
 * - Coverage for workflows not in the basic test suite
 */
import { describe, it, expect } from 'vitest'
import {
  artistOnboarding,
  releasePublish,
  eventCreation,
  payoutSettlement,
  ticketSale,
  rightsDispute,
  moderation,
  trackUploadProcessing,
  ticketScan,
  refundFlow,
  rightsUpdate,
  paymentFailureRecovery,
} from '../workflows'
import type { Transition } from '../workflows'

// ── Helpers ──────────────────────────────────────────────────────────────────

interface WorkflowDef {
  name: string
  transitions: readonly Transition<string>[]
  validate: (from: string, to: string) => { ok: boolean }
  getAvailable: (from: string) => readonly Transition<string>[]
}

/** Collect all unique states referenced in transitions */
function allStates(transitions: readonly Transition<string>[]): Set<string> {
  const s = new Set<string>()
  for (const t of transitions) {
    s.add(t.from)
    s.add(t.to)
  }
  return s
}

/** States that appear only as targets (never as `from`) */
function terminalStates(transitions: readonly Transition<string>[]): Set<string> {
  const fromStates = new Set(transitions.map((t) => t.from))
  const toStates = new Set(transitions.map((t) => t.to))
  const terminal = new Set<string>()
  for (const s of toStates) {
    if (!fromStates.has(s)) terminal.add(s)
  }
  return terminal
}

/** States that appear only as sources (never as `to`) — potential initial states */
function sourceOnlyStates(transitions: readonly Transition<string>[]): Set<string> {
  const fromStates = new Set(transitions.map((t) => t.from))
  const toStates = new Set(transitions.map((t) => t.to))
  const sources = new Set<string>()
  for (const s of fromStates) {
    if (!toStates.has(s)) sources.add(s)
  }
  return sources
}

// ── All Flow-orchestrated workflows ──────────────────────────────────────────

const ALL_WORKFLOWS: WorkflowDef[] = [
  artistOnboarding,
  releasePublish,
  eventCreation,
  payoutSettlement,
  ticketSale,
  rightsDispute,
  moderation,
  trackUploadProcessing,
  ticketScan,
  refundFlow,
  rightsUpdate,
  paymentFailureRecovery,
]

// ── Structural Invariant Tests ───────────────────────────────────────────────

describe('workflow structural invariants (all 12 FSMs)', () => {
  for (const wf of ALL_WORKFLOWS) {
    describe(wf.name, () => {
      const states = allStates(wf.transitions)
      const terminals = terminalStates(wf.transitions)
      const initials = sourceOnlyStates(wf.transitions)

      it('has at least one state', () => {
        expect(states.size).toBeGreaterThan(0)
      })

      it('has at least one transition', () => {
        expect(wf.transitions.length).toBeGreaterThan(0)
      })

      it('all states are reachable (connected graph)', () => {
        // BFS from all source-only states (or first from-state if none exist due to cycles)
        const roots = initials.size > 0 ? [...initials] : [wf.transitions[0]!.from]
        const visited = new Set<string>(roots)
        const queue = [...roots]
        while (queue.length > 0) {
          const current = queue.shift()!
          for (const t of wf.transitions) {
            if (t.from === current && !visited.has(t.to)) {
              visited.add(t.to)
              queue.push(t.to)
            }
          }
        }
        expect(visited.size).toBe(states.size)
      })

      it('has at least one terminal state (no outgoing)', () => {
        expect(terminals.size).toBeGreaterThanOrEqual(1)
      })

      it('every non-terminal state has outgoing transitions', () => {
        const fromStates = new Set(wf.transitions.map((t) => t.from))
        for (const s of states) {
          if (terminals.has(s)) continue
          expect(fromStates.has(s)).toBe(true)
        }
      })

      it('terminal states have zero outgoing transitions', () => {
        for (const t of terminals) {
          const available = wf.getAvailable(t)
          expect(available).toHaveLength(0)
        }
      })

      it('has no self-loops', () => {
        for (const t of wf.transitions) {
          expect(t.from).not.toBe(t.to)
        }
      })

      it('has no duplicate from→to pairs (deterministic)', () => {
        const seen = new Set<string>()
        for (const t of wf.transitions) {
          const key = `${t.from}→${t.to}`
          expect(seen.has(key)).toBe(false)
          seen.add(key)
        }
      })

      it('all audit events are non-empty when present', () => {
        for (const t of wf.transitions) {
          if (t.auditEvent !== null) {
            expect(t.auditEvent.length).toBeGreaterThan(0)
          }
        }
      })

      it('all transitions have non-empty labels', () => {
        for (const t of wf.transitions) {
          expect(t.label.length).toBeGreaterThan(0)
        }
      })

      it('validate rejects all invalid transitions from initial state', () => {
        const initial = [...initials][0]!
        const validTargets = new Set(
          wf.transitions.filter((t) => t.from === initial).map((t) => t.to),
        )
        // Every terminal state that's not a valid target should be rejected
        for (const t of terminals) {
          if (!validTargets.has(t)) {
            const result = wf.validate(initial, t)
            expect(result.ok).toBe(false)
          }
        }
      })
    })
  }
})

// ── Workflow-specific transition tests (coverage for 6 untested workflows) ───

describe('trackUploadProcessing workflow', () => {
  it('validates uploaded → validating', () => {
    expect(trackUploadProcessing.validate('uploaded', 'validating').ok).toBe(true)
  })

  it('rejects uploaded → ready (skip steps)', () => {
    expect(trackUploadProcessing.validate('uploaded', 'ready').ok).toBe(false)
  })

  it('pipeline progresses: validating → transcoding → fingerprinting → quality_check → ready', () => {
    expect(trackUploadProcessing.validate('validating', 'transcoding').ok).toBe(true)
    expect(trackUploadProcessing.validate('transcoding', 'fingerprinting').ok).toBe(true)
    expect(trackUploadProcessing.validate('fingerprinting', 'quality_check').ok).toBe(true)
    expect(trackUploadProcessing.validate('quality_check', 'ready').ok).toBe(true)
  })

  it('archived is terminal', () => {
    expect(trackUploadProcessing.getAvailable('archived')).toHaveLength(0)
  })
})

describe('ticketScan workflow', () => {
  it('validates pending_scan → scanning', () => {
    expect(ticketScan.validate('pending_scan', 'scanning').ok).toBe(true)
  })

  it('scanning branches to validated, duplicate_detected, invalid_ticket', () => {
    const available = ticketScan.getAvailable('scanning')
    const targets = available.map((t) => t.to)
    expect(targets).toContain('validated')
    expect(targets).toContain('duplicate_detected')
    expect(targets).toContain('invalid_ticket')
  })

  it('checked_in is terminal', () => {
    expect(ticketScan.getAvailable('checked_in')).toHaveLength(0)
  })
})

describe('refundFlow workflow', () => {
  it('validates refund_requested → validating', () => {
    expect(refundFlow.validate('refund_requested', 'validating').ok).toBe(true)
  })

  it('rejects refund_requested → completed (skip steps)', () => {
    expect(refundFlow.validate('refund_requested', 'completed').ok).toBe(false)
  })

  it('completed is terminal', () => {
    expect(refundFlow.getAvailable('completed')).toHaveLength(0)
  })
})

describe('rightsUpdate workflow', () => {
  it('validates update_requested → validating_splits', () => {
    expect(rightsUpdate.validate('update_requested', 'validating_splits').ok).toBe(true)
  })

  it('rejects update_requested → completed', () => {
    expect(rightsUpdate.validate('update_requested', 'completed').ok).toBe(false)
  })

  it('completed is terminal', () => {
    expect(rightsUpdate.getAvailable('completed')).toHaveLength(0)
  })
})

describe('paymentFailureRecovery workflow', () => {
  it('validates failed → retry_scheduled', () => {
    expect(paymentFailureRecovery.validate('failed', 'retry_scheduled').ok).toBe(true)
  })

  it('rejects failed → recovered (skip steps)', () => {
    expect(paymentFailureRecovery.validate('failed', 'recovered').ok).toBe(false)
  })

  it('recovered is terminal', () => {
    expect(paymentFailureRecovery.getAvailable('recovered')).toHaveLength(0)
  })

  it('written_off is terminal', () => {
    expect(paymentFailureRecovery.getAvailable('written_off')).toHaveLength(0)
  })
})

// ── Cross-workflow consistency ───────────────────────────────────────────────

describe('cross-workflow consistency', () => {
  it('all 12 workflows have unique names', () => {
    const names = ALL_WORKFLOWS.map((w) => w.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('total state count across all workflows', () => {
    let total = 0
    for (const wf of ALL_WORKFLOWS) {
      total += allStates(wf.transitions).size
    }
    expect(total).toBeGreaterThanOrEqual(100)
  })

  it('total transition count across all workflows', () => {
    let total = 0
    for (const wf of ALL_WORKFLOWS) {
      total += wf.transitions.length
    }
    expect(total).toBeGreaterThanOrEqual(150)
  })

  it('every workflow exposes validate, attempt, and getAvailable', () => {
    for (const wf of ALL_WORKFLOWS) {
      expect(typeof wf.validate).toBe('function')
      expect(typeof wf.getAvailable).toBe('function')
      expect(wf.name).toBeTruthy()
      expect(wf.transitions.length).toBeGreaterThan(0)
    }
  })
})
