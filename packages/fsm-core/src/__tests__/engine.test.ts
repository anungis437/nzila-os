import { describe, it, expect, beforeEach } from 'vitest'

import {
  attemptTransition,
  getAvailableTransitions,
  validateMachine,
  executeTransition,
  registerMachine,
  getMachine,
  listMachines,
  clearRegistry,
  machine,
  transition,
} from '../index'
import type {
  MachineDefinition,
  TransitionContext,
  GuardResolver,
} from '../index'

/* ─── Test fixtures ───────────────────────────────────── */

type TicketState = 'open' | 'in_progress' | 'review' | 'closed' | 'cancelled'
type TicketRole = 'agent' | 'reviewer' | 'admin'

interface Ticket {
  title: string
  priority: 'low' | 'medium' | 'high'
  assignee: string | null
}

const ticketMachine: MachineDefinition<TicketState, Ticket, TicketRole> = {
  name: 'support-ticket',
  version: '1.0.0',
  states: ['open', 'in_progress', 'review', 'closed', 'cancelled'],
  initialState: 'open',
  terminalStates: ['closed', 'cancelled'],
  transitions: [
    {
      from: 'open',
      to: 'in_progress',
      label: 'Start work',
      allowedRoles: ['agent', 'admin'],
      guards: [
        {
          kind: 'predicate',
          name: 'has_assignee',
          fn: (_ctx, entity) => entity.assignee !== null,
        },
      ],
      events: [{ type: 'ticket.started', payload: {} }],
      actions: [],
    },
    {
      from: 'in_progress',
      to: 'review',
      label: 'Submit for review',
      allowedRoles: ['agent', 'admin'],
      guards: [],
      events: [{ type: 'ticket.submitted_for_review', payload: {} }],
      actions: [{ type: 'notify_reviewer', payload: {} }],
    },
    {
      from: 'review',
      to: 'closed',
      label: 'Approve and close',
      allowedRoles: ['reviewer', 'admin'],
      guards: [],
      events: [{ type: 'ticket.closed', payload: {} }],
      actions: [],
    },
    {
      from: 'review',
      to: 'in_progress',
      label: 'Request changes',
      allowedRoles: ['reviewer', 'admin'],
      guards: [],
      events: [{ type: 'ticket.changes_requested', payload: {} }],
      actions: [],
    },
    {
      from: 'open',
      to: 'cancelled',
      label: 'Cancel ticket',
      allowedRoles: ['admin'],
      guards: [],
      events: [{ type: 'ticket.cancelled', payload: {} }],
      actions: [],
    },
    {
      from: 'in_progress',
      to: 'cancelled',
      label: 'Cancel ticket',
      allowedRoles: ['admin'],
      guards: [],
      events: [{ type: 'ticket.cancelled', payload: {} }],
      actions: [],
    },
  ],
}

const org = 'org-1'
const ctx: TransitionContext<TicketRole> = {
  orgId: org,
  actorId: 'user-1',
  role: 'agent',
  meta: {},
}

const ticket: Ticket = { title: 'Fix bug', priority: 'high', assignee: 'user-1' }
const unassigned: Ticket = { title: 'New bug', priority: 'low', assignee: null }

/* ─── attemptTransition ───────────────────────────────── */

describe('attemptTransition', () => {
  it('succeeds for a valid transition with correct role and passing guards', () => {
    const result = attemptTransition(
      ticketMachine,
      'open',
      'in_progress',
      ctx,
      org,
      ticket,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.from).toBe('open')
    expect(result.to).toBe('in_progress')
    expect(result.label).toBe('Start work')
    expect(result.eventsToEmit).toHaveLength(1)
    expect(result.eventsToEmit[0]!.type).toBe('ticket.started')
  })

  it('fails with TERMINAL_STATE when transitioning from a terminal state', () => {
    const result = attemptTransition(
      ticketMachine,
      'closed',
      'open',
      ctx,
      org,
      ticket,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('TERMINAL_STATE')
  })

  it('fails with INVALID_TRANSITION for undefined paths', () => {
    const result = attemptTransition(
      ticketMachine,
      'open',
      'closed',
      ctx,
      org,
      ticket,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('INVALID_TRANSITION')
  })

  it('fails with ORG_MISMATCH when orgs differ', () => {
    const result = attemptTransition(
      ticketMachine,
      'open',
      'in_progress',
      ctx,
      'different-org',
      ticket,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('ORG_MISMATCH')
  })

  it('fails with ROLE_DENIED when role is not allowed', () => {
    const reviewerCtx: TransitionContext<TicketRole> = {
      ...ctx,
      role: 'reviewer',
    }
    const result = attemptTransition(
      ticketMachine,
      'open',
      'in_progress',
      reviewerCtx,
      org,
      ticket,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('ROLE_DENIED')
  })

  it('fails with GUARD_FAILED when a predicate guard rejects', () => {
    const result = attemptTransition(
      ticketMachine,
      'open',
      'in_progress',
      ctx,
      org,
      unassigned,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('GUARD_FAILED')
    expect(result.reason).toContain('has_assignee')
  })

  it('returns events and actions on success', () => {
    const result = attemptTransition(
      ticketMachine,
      'in_progress',
      'review',
      ctx,
      org,
      ticket,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.eventsToEmit).toHaveLength(1)
    expect(result.actionsToSchedule).toHaveLength(1)
    expect(result.actionsToSchedule[0]!.type).toBe('notify_reviewer')
  })
})

/* ─── Named guards with resolver ──────────────────────── */

describe('named guards', () => {
  const machineWithNamedGuard: MachineDefinition<'a' | 'b', unknown, string> = {
    name: 'named-guard-test',
    version: '1.0.0',
    states: ['a', 'b'],
    initialState: 'a',
    terminalStates: ['b'],
    transitions: [
      {
        from: 'a',
        to: 'b',
        label: 'Go',
        allowedRoles: [],
        guards: [{ kind: 'named', name: 'custom_check' }],
        events: [],
        actions: [],
      },
    ],
  }

  const anyCtx: TransitionContext = {
    orgId: 'o',
    actorId: 'u',
    role: 'any',
    meta: {},
  }

  it('fails when no resolver is provided for a named guard', () => {
    const result = attemptTransition(machineWithNamedGuard, 'a', 'b', anyCtx, 'o', {})
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('GUARD_FAILED')
    expect(result.reason).toContain('GuardResolver')
  })

  it('passes when resolver returns true', () => {
    const resolver: GuardResolver = () => true
    const result = attemptTransition(
      machineWithNamedGuard,
      'a',
      'b',
      anyCtx,
      'o',
      {},
      resolver,
    )
    expect(result.ok).toBe(true)
  })

  it('fails when resolver returns false', () => {
    const resolver: GuardResolver = () => false
    const result = attemptTransition(
      machineWithNamedGuard,
      'a',
      'b',
      anyCtx,
      'o',
      {},
      resolver,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('GUARD_FAILED')
  })
})

/* ─── getAvailableTransitions ─────────────────────────── */

describe('getAvailableTransitions', () => {
  it('returns transitions available for the current role and state', () => {
    const available = getAvailableTransitions(
      ticketMachine,
      'open',
      ctx,
      org,
      ticket,
    )
    expect(available).toHaveLength(1)
    expect(available[0]!.to).toBe('in_progress')
  })

  it('returns empty for terminal states', () => {
    const available = getAvailableTransitions(
      ticketMachine,
      'closed',
      ctx,
      org,
      ticket,
    )
    expect(available).toHaveLength(0)
  })

  it('returns empty for org mismatch', () => {
    const available = getAvailableTransitions(
      ticketMachine,
      'open',
      ctx,
      'wrong-org',
      ticket,
    )
    expect(available).toHaveLength(0)
  })

  it('includes admin-only transitions for admin role', () => {
    const adminCtx: TransitionContext<TicketRole> = { ...ctx, role: 'admin' }
    const available = getAvailableTransitions(
      ticketMachine,
      'open',
      adminCtx,
      org,
      ticket,
    )
    // agent can start work + admin can also cancel
    expect(available).toHaveLength(2)
    const labels = available.map((t) => t.label)
    expect(labels).toContain('Start work')
    expect(labels).toContain('Cancel ticket')
  })

  it('filters out transitions where guards fail', () => {
    const available = getAvailableTransitions(
      ticketMachine,
      'open',
      ctx,
      org,
      unassigned, // has_assignee guard will fail
    )
    expect(available).toHaveLength(0)
  })
})

/* ─── validateMachine ─────────────────────────────────── */

describe('validateMachine', () => {
  it('passes for a valid machine', () => {
    expect(validateMachine(ticketMachine)).toHaveLength(0)
  })

  it('detects invalid initial state', () => {
    const bad = { ...ticketMachine, initialState: 'nonexistent' as TicketState }
    const errors = validateMachine(bad)
    expect(errors.some((e) => e.includes('initialState'))).toBe(true)
  })

  it('detects invalid terminal state', () => {
    const bad = {
      ...ticketMachine,
      terminalStates: ['nonexistent'] as TicketState[],
    }
    const errors = validateMachine(bad)
    expect(errors.some((e) => e.includes('terminalState'))).toBe(true)
  })

  it('detects transitions from terminal states', () => {
    const bad = {
      ...ticketMachine,
      transitions: [
        ...ticketMachine.transitions,
        {
          from: 'closed' as TicketState,
          to: 'open' as TicketState,
          label: 'Reopen',
          allowedRoles: [] as TicketRole[],
          guards: [],
          events: [],
          actions: [],
        },
      ],
    }
    const errors = validateMachine(bad)
    expect(errors.some((e) => e.includes('terminal state'))).toBe(true)
  })

  it('detects dead states', () => {
    const bad = {
      ...ticketMachine,
      states: [...ticketMachine.states, 'orphan'] as TicketState[],
    }
    const errors = validateMachine(bad)
    expect(errors.some((e) => e.includes('dead state'))).toBe(true)
  })
})

/* ─── executeTransition (audited) ─────────────────────── */

describe('executeTransition', () => {
  it('returns a transition record on success', () => {
    const { result, record } = executeTransition(
      ticketMachine,
      'open',
      'in_progress',
      ctx,
      org,
      ticket,
      { entityId: 'ticket-123', reason: 'Starting work on bug' },
    )
    expect(result.ok).toBe(true)
    expect(record).not.toBeNull()
    expect(record!.machineName).toBe('support-ticket')
    expect(record!.machineVersion).toBe('1.0.0')
    expect(record!.entityId).toBe('ticket-123')
    expect(record!.orgId).toBe(org)
    expect(record!.from).toBe('open')
    expect(record!.to).toBe('in_progress')
    expect(record!.actorId).toBe('user-1')
    expect(record!.reason).toBe('Starting work on bug')
    expect(record!.transitionId).toBeTruthy()
    expect(record!.timestamp).toBeTruthy()
    expect(record!.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('returns null record on failure', () => {
    const { result, record } = executeTransition(
      ticketMachine,
      'closed',
      'open',
      ctx,
      org,
      ticket,
    )
    expect(result.ok).toBe(false)
    expect(record).toBeNull()
  })
})

/* ─── Registry ────────────────────────────────────────── */

describe('registry', () => {
  beforeEach(() => {
    clearRegistry()
  })

  it('registers and retrieves a machine', () => {
    registerMachine(ticketMachine)
    expect(getMachine('support-ticket')).toBe(ticketMachine)
    expect(listMachines()).toContain('support-ticket')
  })

  it('throws on invalid machine registration', () => {
    const bad: MachineDefinition = {
      name: 'broken',
      version: '0.0.1',
      states: ['a'],
      initialState: 'z',
      terminalStates: [],
      transitions: [],
    }
    expect(() => registerMachine(bad)).toThrow('Invalid machine "broken"')
  })
})

/* ─── Builders ────────────────────────────────────────── */

describe('builders', () => {
  it('builds a valid machine from builder API', () => {
    type S = 'draft' | 'published' | 'archived'

    const m = machine<S>('article', '1.0.0')
      .states(['draft', 'published', 'archived'])
      .initial('draft')
      .terminal('archived')
      .addTransition(
        transition<S>('draft', 'published', 'Publish')
          .allowRoles('editor', 'admin')
          .emits('article.published'),
      )
      .addTransition(
        transition<S>('published', 'archived', 'Archive')
          .allowRoles('admin')
          .emits('article.archived'),
      )
      .build()

    expect(validateMachine(m)).toHaveLength(0)
    expect(m.name).toBe('article')
    expect(m.transitions).toHaveLength(2)
  })

  it('supports predicate guards via builder', () => {
    type S = 'a' | 'b'
    interface Entity {
      value: number
    }

    const m = machine<S, Entity>('guarded', '1.0.0')
      .states(['a', 'b'])
      .initial('a')
      .terminal('b')
      .addTransition(
        transition<S, Entity>('a', 'b', 'Go')
          .guard('predicate', 'min_value', (_ctx, entity) => entity.value > 10),
      )
      .build()

    const anyCtx: TransitionContext = {
      orgId: 'o',
      actorId: 'u',
      role: 'any',
      meta: {},
    }

    const pass = attemptTransition(m, 'a', 'b', anyCtx, 'o', { value: 20 })
    expect(pass.ok).toBe(true)

    const fail = attemptTransition(m, 'a', 'b', anyCtx, 'o', { value: 5 })
    expect(fail.ok).toBe(false)
  })

  it('supports timeout via builder', () => {
    type S = 'active' | 'expired'
    const m = machine<S>('expiry', '1.0.0')
      .states(['active', 'expired'])
      .initial('active')
      .terminal('expired')
      .addTransition(
        transition<S>('active', 'expired', 'Expire')
          .timeout(86_400_000, 'expired')
          .emits('item.expired'),
      )
      .build()

    expect(validateMachine(m)).toHaveLength(0)
    expect(m.transitions[0]!.timeout!.delayMs).toBe(86_400_000)
  })
})
