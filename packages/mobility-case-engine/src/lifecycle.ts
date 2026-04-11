/* ── Case Workflow Engine ──────────────────────────────────
 *
 * Full lifecycle state machine for mobility cases.
 * Manages transitions from lead intake through citizenship
 * granting and renewal monitoring.
 *
 * @module @nzila/mobility-case-engine
 */

import type { CaseStatus, CaseStage, TaskType } from '@nzila/mobility-core'
import { machine, transition, type MachineDefinition } from '@nzila/fsm-core'

/* ── Lifecycle States ─────────────────────────────────────── */

export const CASE_LIFECYCLE = [
  'lead',
  'client_intake',
  'kyc_review',
  'program_selection',
  'document_collection',
  'legal_review',
  'submission_ready',
  'submitted',
  'government_processing',
  'approved',
  'citizenship_granted',
  'renewal_monitoring',
] as const
export type CaseLifecycleState = (typeof CASE_LIFECYCLE)[number]

/* ── Transition Rules ─────────────────────────────────────── */

interface TransitionRule {
  from: CaseLifecycleState
  to: CaseLifecycleState
  guard?: string
}

const TRANSITION_RULES: TransitionRule[] = [
  { from: 'lead', to: 'client_intake' },
  { from: 'client_intake', to: 'kyc_review', guard: 'profile_complete' },
  { from: 'kyc_review', to: 'program_selection', guard: 'compliance_cleared' },
  { from: 'program_selection', to: 'document_collection', guard: 'program_selected' },
  { from: 'document_collection', to: 'legal_review', guard: 'documents_uploaded' },
  { from: 'legal_review', to: 'submission_ready', guard: 'legal_approved' },
  { from: 'submission_ready', to: 'submitted', guard: 'advisor_confirmed' },
  { from: 'submitted', to: 'government_processing' },
  { from: 'government_processing', to: 'approved', guard: 'government_approved' },
  { from: 'approved', to: 'citizenship_granted', guard: 'oath_completed' },
  { from: 'citizenship_granted', to: 'renewal_monitoring' },
]

// ── fsm-core machine definition ─────────────────────────────

/**
 * Case lifecycle as an @nzila/fsm-core MachineDefinition.
 *
 * Guards are expressed as named references — the consuming app
 * supplies a GuardResolver that maps guard names to predicates.
 */
export const CaseLifecycleMachine: MachineDefinition<CaseLifecycleState> = (() => {
  const builder = machine<CaseLifecycleState>('case-lifecycle', '1.0.0')
    .states([...CASE_LIFECYCLE])
    .initial('lead')
    .terminal('renewal_monitoring')

  for (const rule of TRANSITION_RULES) {
    const t = transition<CaseLifecycleState>(
      rule.from,
      rule.to,
      `${rule.from.replace(/_/g, ' ')} → ${rule.to.replace(/_/g, ' ')}`,
    )
    if (rule.guard) {
      t.guard('named', rule.guard)
    }
    builder.addTransition(t)
  }

  return builder.build()
})()

/* ── Case State ───────────────────────────────────────────── */

export interface CaseState {
  caseId: string
  lifecycle: CaseLifecycleState
  caseStatus: CaseStatus
  caseStage: CaseStage
  assignedAdvisorId: string
  milestones: CaseMilestone[]
  pendingTasks: CaseTaskItem[]
  deadlines: CaseDeadline[]
  history: CaseTransitionRecord[]
}

export interface CaseMilestone {
  name: string
  completedAt: Date | null
  lifecycle: CaseLifecycleState
}

export interface CaseTaskItem {
  taskType: TaskType
  description: string
  assignedTo: string
  dueDate: Date | null
  completed: boolean
}

export interface CaseDeadline {
  description: string
  date: Date
  critical: boolean
}

export interface CaseTransitionRecord {
  from: CaseLifecycleState
  to: CaseLifecycleState
  timestamp: Date
  actorId: string
  notes: string
}

/* ── State Machine ────────────────────────────────────────── */

/**
 * Initialize a new case at the lead stage.
 */
export function initCase(caseId: string, advisorId: string): CaseState {
  return {
    caseId,
    lifecycle: 'lead',
    caseStatus: 'draft',
    caseStage: 'pre_engagement',
    assignedAdvisorId: advisorId,
    milestones: CASE_LIFECYCLE.map((state) => ({
      name: state.replace(/_/g, ' '),
      completedAt: null,
      lifecycle: state,
    })),
    pendingTasks: [],
    deadlines: [],
    history: [],
  }
}

/**
 * Check if a transition from the current state to a target state is valid.
 */
export function canTransition(
  current: CaseLifecycleState,
  target: CaseLifecycleState,
): { allowed: boolean; guard: string | null } {
  const rule = TRANSITION_RULES.find((r) => r.from === current && r.to === target)
  if (!rule) return { allowed: false, guard: null }
  return { allowed: true, guard: rule.guard ?? null }
}

/**
 * Get the next valid lifecycle state from current state.
 */
export function getNextLifecycleState(
  current: CaseLifecycleState,
): CaseLifecycleState | null {
  const rule = TRANSITION_RULES.find((r) => r.from === current)
  return rule?.to ?? null
}

/**
 * Advance the case to the next lifecycle state.
 * Records the transition in history and updates milestones.
 */
export function advanceCase(
  state: CaseState,
  actorId: string,
  notes = '',
): CaseState {
  const next = getNextLifecycleState(state.lifecycle)
  if (!next) return state

  const { allowed } = canTransition(state.lifecycle, next)
  if (!allowed) return state

  const now = new Date()
  const updatedMilestones = state.milestones.map((m) =>
    m.lifecycle === state.lifecycle && !m.completedAt
      ? { ...m, completedAt: now }
      : m,
  )

  return {
    ...state,
    lifecycle: next,
    caseStatus: mapLifecycleToCaseStatus(next),
    caseStage: mapLifecycleToCaseStage(next),
    milestones: updatedMilestones,
    history: [
      ...state.history,
      {
        from: state.lifecycle,
        to: next,
        timestamp: now,
        actorId,
        notes,
      },
    ],
  }
}

/**
 * Add a task to the case's pending tasks.
 */
export function addTask(
  state: CaseState,
  task: CaseTaskItem,
): CaseState {
  return {
    ...state,
    pendingTasks: [...state.pendingTasks, task],
  }
}

/**
 * Mark a task as completed.
 */
export function completeTask(
  state: CaseState,
  taskIndex: number,
): CaseState {
  const updatedTasks = state.pendingTasks.map((t, i) =>
    i === taskIndex ? { ...t, completed: true } : t,
  )
  return { ...state, pendingTasks: updatedTasks }
}

/**
 * Add a deadline to the case.
 */
export function addDeadline(
  state: CaseState,
  deadline: CaseDeadline,
): CaseState {
  return {
    ...state,
    deadlines: [...state.deadlines, deadline].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    ),
  }
}

/**
 * Generate the standard task list for the given lifecycle state.
 */
export function generateTasksForState(
  lifecycle: CaseLifecycleState,
  advisorId: string,
): CaseTaskItem[] {
  const tasks: CaseTaskItem[] = []

  switch (lifecycle) {
    case 'client_intake':
      tasks.push(
        { taskType: 'client_meeting', description: 'Initial consultation', assignedTo: advisorId, dueDate: null, completed: false },
        { taskType: 'document_collection', description: 'Collect identity documents', assignedTo: advisorId, dueDate: null, completed: false },
      )
      break
    case 'kyc_review':
      tasks.push(
        { taskType: 'kyc_review', description: 'Run KYC checks', assignedTo: advisorId, dueDate: null, completed: false },
        { taskType: 'aml_check', description: 'AML screening', assignedTo: advisorId, dueDate: null, completed: false },
      )
      break
    case 'document_collection':
      tasks.push(
        { taskType: 'document_collection', description: 'Collect programme-specific documents', assignedTo: advisorId, dueDate: null, completed: false },
        { taskType: 'payment_verification', description: 'Verify investment source of funds', assignedTo: advisorId, dueDate: null, completed: false },
      )
      break
    case 'submission_ready':
      tasks.push(
        { taskType: 'government_filing', description: 'Prepare government submission package', assignedTo: advisorId, dueDate: null, completed: false },
      )
      break
    case 'renewal_monitoring':
      tasks.push(
        { taskType: 'follow_up', description: 'Schedule renewal check', assignedTo: advisorId, dueDate: null, completed: false },
      )
      break
  }

  return tasks
}

/* ── Mappers ──────────────────────────────────────────────── */

function mapLifecycleToCaseStatus(lifecycle: CaseLifecycleState): CaseStatus {
  const mapping: Record<CaseLifecycleState, CaseStatus> = {
    lead: 'draft',
    client_intake: 'intake',
    kyc_review: 'kyc_pending',
    program_selection: 'intake',
    document_collection: 'document_verification',
    legal_review: 'compliance_review',
    submission_ready: 'compliance_review',
    submitted: 'submitted',
    government_processing: 'processing',
    approved: 'approved',
    citizenship_granted: 'granted',
    renewal_monitoring: 'granted',
  }
  return mapping[lifecycle]
}

function mapLifecycleToCaseStage(lifecycle: CaseLifecycleState): CaseStage {
  const mapping: Record<CaseLifecycleState, CaseStage> = {
    lead: 'pre_engagement',
    client_intake: 'onboarding',
    kyc_review: 'due_diligence',
    program_selection: 'due_diligence',
    document_collection: 'application_prep',
    legal_review: 'application_prep',
    submission_ready: 'application_prep',
    submitted: 'government_submission',
    government_processing: 'adjudication',
    approved: 'post_approval',
    citizenship_granted: 'post_approval',
    renewal_monitoring: 'maintenance',
  }
  return mapping[lifecycle]
}
