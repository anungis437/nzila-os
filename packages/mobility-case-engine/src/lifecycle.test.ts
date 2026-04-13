import { describe, it, expect } from 'vitest'
import {
  initCase,
  canTransition,
  getNextLifecycleState,
  advanceCase,
  addTask,
  completeTask,
  addDeadline,
  generateTasksForState,
  CASE_LIFECYCLE,
} from './lifecycle'
import * as packageExports from './index'

describe('initCase', () => {
  it('creates a case at the lead stage', () => {
    const state = initCase('case-1', 'advisor-1')

    expect(state.caseId).toBe('case-1')
    expect(state.lifecycle).toBe('lead')
    expect(state.caseStatus).toBe('draft')
    expect(state.caseStage).toBe('pre_engagement')
    expect(state.assignedAdvisorId).toBe('advisor-1')
    expect(state.milestones).toHaveLength(CASE_LIFECYCLE.length)
    expect(state.pendingTasks).toHaveLength(0)
    expect(state.deadlines).toHaveLength(0)
    expect(state.history).toHaveLength(0)
  })
})

describe('canTransition', () => {
  it('allows valid transition from lead to client_intake', () => {
    const result = canTransition('lead', 'client_intake')
    expect(result.allowed).toBe(true)
  })

  it('rejects invalid transition', () => {
    const result = canTransition('lead', 'approved')
    expect(result.allowed).toBe(false)
  })

  it('returns guard condition for guarded transitions', () => {
    const result = canTransition('client_intake', 'kyc_review')
    expect(result.allowed).toBe(true)
    expect(result.guard).toBe('profile_complete')
  })

  it('returns null guard for unguarded transitions', () => {
    const result = canTransition('lead', 'client_intake')
    expect(result.guard).toBeNull()
  })
})

describe('getNextLifecycleState', () => {
  it('returns next state in sequence', () => {
    expect(getNextLifecycleState('lead')).toBe('client_intake')
    expect(getNextLifecycleState('kyc_review')).toBe('program_selection')
    expect(getNextLifecycleState('approved')).toBe('citizenship_granted')
  })

  it('returns null for terminal state', () => {
    expect(getNextLifecycleState('renewal_monitoring')).toBeNull()
  })
})

describe('advanceCase', () => {
  it('advances case to next lifecycle state', () => {
    const initial = initCase('case-1', 'advisor-1')
    const next = advanceCase(initial, 'advisor-1', 'Moving to intake')

    expect(next.lifecycle).toBe('client_intake')
    expect(next.history).toHaveLength(1)
    expect(next.history[0].from).toBe('lead')
    expect(next.history[0].to).toBe('client_intake')
    expect(next.history[0].actorId).toBe('advisor-1')
    expect(next.history[0].notes).toBe('Moving to intake')
  })

  it('updates milestones on transition', () => {
    const initial = initCase('case-1', 'advisor-1')
    const next = advanceCase(initial, 'advisor-1')

    const leadMilestone = next.milestones.find(m => m.lifecycle === 'lead')
    expect(leadMilestone?.completedAt).toBeInstanceOf(Date)
  })

  it('returns unchanged state when there is no next lifecycle state', () => {
    const terminal = {
      ...initCase('case-2', 'advisor-2'),
      lifecycle: 'renewal_monitoring' as const,
    }

    const result = advanceCase(terminal, 'advisor-2', 'No-op at terminal state')

    expect(result).toBe(terminal)
  })
})

describe('addTask', () => {
  it('adds a pending task', () => {
    const state = initCase('case-1', 'advisor-1')
    const updated = addTask(state, {
      taskType: 'document_collection',
      description: 'Collect passport copy',
      assignedTo: 'advisor-1',
      dueDate: null,
      completed: false,
    })

    expect(updated.pendingTasks).toHaveLength(1)
    expect(updated.pendingTasks[0].taskType).toBe('document_collection')
  })
})

describe('completeTask', () => {
  it('marks a task as completed', () => {
    let state = initCase('case-1', 'advisor-1')
    state = addTask(state, {
      taskType: 'kyc_review',
      description: 'Review KYC',
      assignedTo: 'advisor-1',
      dueDate: null,
      completed: false,
    })

    const taskIndex = state.pendingTasks.findIndex(t => t.taskType === 'kyc_review')
    const updated = completeTask(state, taskIndex)
    const task = updated.pendingTasks.find(t => t.taskType === 'kyc_review')
    expect(task?.completed).toBe(true)
  })

  it('leaves tasks unchanged when index is out of bounds', () => {
    let state = initCase('case-2', 'advisor-2')
    state = addTask(state, {
      taskType: 'kyc_review',
      description: 'Review KYC',
      assignedTo: 'advisor-2',
      dueDate: null,
      completed: false,
    })

    const updated = completeTask(state, 99)
    expect(updated.pendingTasks[0]?.completed).toBe(false)
  })
})

describe('addDeadline', () => {
  it('adds a deadline to the case', () => {
    const state = initCase('case-1', 'advisor-1')
    const deadline = {
      description: 'Government submission deadline',
      date: new Date('2025-12-31'),
      critical: true,
    }

    const updated = addDeadline(state, deadline)
    expect(updated.deadlines).toHaveLength(1)
    expect(updated.deadlines[0].critical).toBe(true)
  })

  it('keeps deadlines sorted by date', () => {
    const state = initCase('case-3', 'advisor-3')
    const withLater = addDeadline(state, {
      description: 'Later deadline',
      date: new Date('2026-01-15'),
      critical: false,
    })
    const withBoth = addDeadline(withLater, {
      description: 'Sooner deadline',
      date: new Date('2026-01-10'),
      critical: true,
    })

    expect(withBoth.deadlines[0]?.description).toBe('Sooner deadline')
    expect(withBoth.deadlines[1]?.description).toBe('Later deadline')
  })
})

describe('generateTasksForState', () => {
  it('generates expected tasks for client_intake', () => {
    const tasks = generateTasksForState('client_intake', 'advisor-1')
    expect(tasks).toHaveLength(2)
    expect(tasks.map(t => t.taskType)).toContain('client_meeting')
  })

  it('generates expected tasks for kyc_review', () => {
    const tasks = generateTasksForState('kyc_review', 'advisor-1')
    expect(tasks).toHaveLength(2)
    expect(tasks.map(t => t.taskType)).toContain('aml_check')
  })

  it('generates expected tasks for document_collection', () => {
    const tasks = generateTasksForState('document_collection', 'advisor-1')
    expect(tasks).toHaveLength(2)
    expect(tasks.map(t => t.taskType)).toContain('payment_verification')
  })

  it('generates expected tasks for submission_ready', () => {
    const tasks = generateTasksForState('submission_ready', 'advisor-1')
    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.taskType).toBe('government_filing')
  })

  it('generates expected tasks for renewal_monitoring', () => {
    const tasks = generateTasksForState('renewal_monitoring', 'advisor-1')
    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.taskType).toBe('follow_up')
  })

  it('returns empty task list for states without defaults', () => {
    const tasks = generateTasksForState('lead', 'advisor-1')
    expect(tasks).toEqual([])
  })
})

describe('package index', () => {
  it('exports runtime lifecycle APIs', () => {
    expect(packageExports.initCase).toBeTypeOf('function')
    expect(packageExports.generateTasksForState).toBeTypeOf('function')
  })
})
