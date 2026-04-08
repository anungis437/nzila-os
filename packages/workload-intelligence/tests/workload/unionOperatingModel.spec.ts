import { describe, it, expect, vi } from 'vitest'

// ─── Authority / Permissions ─────────────────────────────────────
import {
  canCreateIntake,
  canCreateOfficialWorkItem,
  canConvertIntake,
  canAssignPriority,
  canOverridePriority,
  STEWARD_THRESHOLD,
} from '../../src/authority/permissions.js'
import type { AuthorityRole } from '../../src/authority/permissions.js'

// ─── Workflow ────────────────────────────────────────────────────
import { createIntakeWorkflow, isTerminalIntakeStatus } from '../../src/workflow/intakeLifecycle.js'
import type { IntakeSubmission } from '../../src/models/types.js'

// ─── Models & Schemas ────────────────────────────────────────────
import {
  intakeSubmissionSchema,
  officialWorkItemSchema,
  IntakeStatuses,
  OfficialWorkItemStatuses,
  QueueBucketTypes,
  WorkItemTypes,
} from '../../src/models/types.js'

// ─── Engine ──────────────────────────────────────────────────────
import { createPrioritizationEngine } from '../../src/engine/prioritizationEngine.js'
import type { WorkItem } from '../../src/models/types.js'

// ─── NIL Prompt Registry ─────────────────────────────────────────
import {
  createPromptRegistry,
  IntakePromptFamilies,
  CasePromptFamilies,
} from '../../src/prompts/promptRegistry.js'

// ─── Override Manager ────────────────────────────────────────────
import { createOverrideManager } from '../../src/overrides/overrideManager.js'

// ─── Helpers ─────────────────────────────────────────────────────

function makeIntake(overrides: Partial<IntakeSubmission> = {}): IntakeSubmission {
  return {
    id: 'intake-1',
    orgId: 'org-1',
    submittedByMemberId: 'member-1',
    title: 'Unsafe working conditions on Line 3',
    description: 'The forklift area near dock 7 has no safety barriers.',
    submittedAt: new Date().toISOString(),
    attachments: [],
    urgencyIndicators: [],
    status: 'new',
    metadata: {},
    ...overrides,
  }
}

function makeWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'item-1',
    orgId: 'org-1',
    type: 'grievance',
    title: 'Test grievance',
    createdAt: new Date().toISOString(),
    stakeholders: ['steward-1'],
    urgencySignals: [],
    riskSignals: [],
    strategicSignals: [],
    metadata: {},
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 2: Permissions / Authority Model
// ═══════════════════════════════════════════════════════════════════

describe('authority/permissions', () => {
  const MEMBER_ROLES: AuthorityRole[] = ['member']
  const REP_ROLES: AuthorityRole[] = [
    'bargaining_committee', 'steward', 'officer', 'chief_steward',
    'admin', 'president', 'system_admin',
  ]

  describe('canCreateIntake', () => {
    it('allows all authenticated users (member+)', () => {
      for (const role of [...MEMBER_ROLES, ...REP_ROLES]) {
        expect(canCreateIntake(role)).toBe(true)
      }
    })
  })

  describe('canCreateOfficialWorkItem', () => {
    it('rejects member role', () => {
      expect(canCreateOfficialWorkItem('member')).toBe(false)
    })

    it('rejects health_safety_rep (below threshold)', () => {
      expect(canCreateOfficialWorkItem('health_safety_rep')).toBe(false)
    })

    it('allows bargaining_committee+ (at threshold)', () => {
      for (const role of REP_ROLES) {
        expect(canCreateOfficialWorkItem(role)).toBe(true)
      }
    })
  })

  describe('canConvertIntake', () => {
    it('mirrors canCreateOfficialWorkItem — members cannot convert', () => {
      expect(canConvertIntake('member')).toBe(false)
      expect(canConvertIntake('steward')).toBe(true)
    })
  })

  describe('canAssignPriority', () => {
    it('only reps can assign priority', () => {
      expect(canAssignPriority('member')).toBe(false)
      expect(canAssignPriority('bargaining_committee')).toBe(true)
    })
  })

  describe('canOverridePriority', () => {
    it('requires chief_steward+', () => {
      expect(canOverridePriority('member')).toBe(false)
      expect(canOverridePriority('steward')).toBe(false)
      expect(canOverridePriority('chief_steward')).toBe(true)
      expect(canOverridePriority('admin')).toBe(true)
    })
  })

  it('STEWARD_THRESHOLD matches bargaining_committee level', () => {
    expect(STEWARD_THRESHOLD).toBe(40)
  })
})

// ═══════════════════════════════════════════════════════════════════
// SECTION 1 & 8: Domain Models & Schemas
// ═══════════════════════════════════════════════════════════════════

describe('domain models', () => {
  describe('IntakeSubmission schema', () => {
    it('validates a well-formed intake', () => {
      const result = intakeSubmissionSchema.safeParse(makeIntake())
      expect(result.success).toBe(true)
    })

    it('rejects intake missing submittedByMemberId', () => {
      const result = intakeSubmissionSchema.safeParse({
        ...makeIntake(),
        submittedByMemberId: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid intake status', () => {
      const result = intakeSubmissionSchema.safeParse({
        ...makeIntake(),
        status: 'filed',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('OfficialWorkItem schema', () => {
    it('validates a well-formed official work item', () => {
      const result = officialWorkItemSchema.safeParse({
        id: 'case-1',
        orgId: 'org-1',
        createdByRepId: 'steward-1',
        sourceIntakeId: 'intake-1',
        type: 'grievance',
        title: 'Unsafe conditions grievance',
        createdAt: new Date().toISOString(),
        stakeholders: ['steward-1'],
        status: 'active',
        urgencySignals: [],
        riskSignals: [],
        strategicSignals: [],
        metadata: {},
      })
      expect(result.success).toBe(true)
    })

    it('rejects work item missing createdByRepId', () => {
      const result = officialWorkItemSchema.safeParse({
        id: 'case-1',
        orgId: 'org-1',
        createdByRepId: '',
        type: 'grievance',
        title: 'Test',
        createdAt: new Date().toISOString(),
        stakeholders: [],
        status: 'active',
        urgencySignals: [],
        riskSignals: [],
        strategicSignals: [],
        metadata: {},
      })
      expect(result.success).toBe(false)
    })

    it('allows consultation type', () => {
      const result = officialWorkItemSchema.safeParse({
        id: 'case-1',
        orgId: 'org-1',
        createdByRepId: 'steward-1',
        type: 'consultation',
        title: 'Member consult',
        createdAt: new Date().toISOString(),
        stakeholders: [],
        status: 'active',
        urgencySignals: [],
        riskSignals: [],
        strategicSignals: [],
        metadata: {},
      })
      expect(result.success).toBe(true)
    })
  })

  describe('constants', () => {
    it('WorkItemTypes includes consultation', () => {
      expect(WorkItemTypes.CONSULTATION).toBe('consultation')
    })

    it('IntakeStatuses has all 5 states', () => {
      expect(Object.keys(IntakeStatuses)).toHaveLength(5)
    })

    it('OfficialWorkItemStatuses has 3 states', () => {
      expect(Object.keys(OfficialWorkItemStatuses)).toHaveLength(3)
    })

    it('QueueBucketTypes has 5 buckets', () => {
      expect(Object.keys(QueueBucketTypes)).toHaveLength(5)
      expect(QueueBucketTypes.INTAKE_REVIEW).toBe('intake_review')
      expect(QueueBucketTypes.ACTIVE_CASES).toBe('active_cases')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// SECTION 3: Workflow / Intake Lifecycle
// ═══════════════════════════════════════════════════════════════════

describe('intake lifecycle workflow', () => {
  describe('isTerminalIntakeStatus', () => {
    it('converted is terminal', () => {
      expect(isTerminalIntakeStatus('converted')).toBe(true)
    })

    it('closed_no_case is terminal', () => {
      expect(isTerminalIntakeStatus('closed_no_case')).toBe(true)
    })

    it('new is not terminal', () => {
      expect(isTerminalIntakeStatus('new')).toBe(false)
    })
  })

  describe('transition', () => {
    it('allows new → under_review for any role', () => {
      const wf = createIntakeWorkflow(makeIntake({ status: 'new' }))
      const result = wf.transition('under_review', 'member')
      expect(result.success).toBe(true)
      expect(result.newStatus).toBe('under_review')
    })

    it('blocks member from converting intake to official case', () => {
      const wf = createIntakeWorkflow(makeIntake({ status: 'under_review' }))
      const result = wf.transition('converted', 'member')
      expect(result.success).toBe(false)
      expect(result.reason).toContain('rep/LRO')
    })

    it('allows steward to convert intake', () => {
      const wf = createIntakeWorkflow(makeIntake({ status: 'under_review' }))
      const result = wf.transition('converted', 'steward')
      expect(result.success).toBe(true)
      expect(result.newStatus).toBe('converted')
    })

    it('allows bargaining_committee to close intake (no case)', () => {
      const wf = createIntakeWorkflow(makeIntake({ status: 'under_review' }))
      const result = wf.transition('closed_no_case', 'bargaining_committee')
      expect(result.success).toBe(true)
    })

    it('blocks member from closing intake', () => {
      const wf = createIntakeWorkflow(makeIntake({ status: 'new' }))
      const result = wf.transition('closed_no_case', 'member')
      expect(result.success).toBe(false)
    })

    it('blocks transitions from terminal states', () => {
      const wf = createIntakeWorkflow(makeIntake({ status: 'converted' }))
      const result = wf.transition('under_review', 'admin')
      expect(result.success).toBe(false)
      expect(result.reason).toContain('terminal')
    })

    it('rejects invalid transition paths', () => {
      const wf = createIntakeWorkflow(makeIntake({ status: 'new' }))
      const result = wf.transition('converted', 'admin') // can't skip under_review
      expect(result.success).toBe(false)
    })
  })

  describe('availableTransitions', () => {
    it('member sees under_review from new (no close)', () => {
      const wf = createIntakeWorkflow(makeIntake({ status: 'new' }))
      const available = wf.availableTransitions('member')
      expect(available).toContain('under_review')
      expect(available).not.toContain('closed_no_case')
    })

    it('steward sees all transitions from under_review', () => {
      const wf = createIntakeWorkflow(makeIntake({ status: 'under_review' }))
      const available = wf.availableTransitions('steward')
      expect(available).toContain('awaiting_member_info')
      expect(available).toContain('converted')
      expect(available).toContain('closed_no_case')
    })

    it('terminal state has no available transitions', () => {
      const wf = createIntakeWorkflow(makeIntake({ status: 'closed_no_case' }))
      const available = wf.availableTransitions('admin')
      expect(available).toHaveLength(0)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// SECTION 4: WIL Queue Buckets
// ═══════════════════════════════════════════════════════════════════

describe('queue buckets', () => {
  describe('prioritizeIntakes', () => {
    it('returns empty for no intakes', async () => {
      const engine = createPrioritizationEngine(null)
      const result = await engine.prioritizeIntakes('org-1', [])
      expect(result).toEqual([])
    })

    it('scores intakes and returns sorted results', async () => {
      const engine = createPrioritizationEngine(null)
      const intakes = [
        makeIntake({ id: 'low', urgencyIndicators: [] }),
        makeIntake({
          id: 'high',
          urgencyIndicators: [{ type: 'escalation', weight: 0.9 }],
        }),
      ]
      const result = await engine.prioritizeIntakes('org-1', intakes)
      expect(result).toHaveLength(2)
      expect(result[0]!.id).toBe('high')
      expect(result[0]!.priorityScore).toBeGreaterThan(result[1]!.priorityScore)
    })

    it('enforces org isolation', async () => {
      const engine = createPrioritizationEngine(null)
      const intakes = [
        makeIntake({ id: 'mine', orgId: 'org-1' }),
        makeIntake({ id: 'theirs', orgId: 'org-2' }),
      ]
      const result = await engine.prioritizeIntakes('org-1', intakes)
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('mine')
    })

    it('calls NIL with assess_intake_urgency useCase', async () => {
      const mockNil = {
        reason: vi.fn().mockResolvedValue({
          success: true,
          explanation: { summary: 'Urgent safety concern' },
          confidence: 0.8,
        }),
      }
      const engine = createPrioritizationEngine(mockNil)
      await engine.prioritizeIntakes('org-1', [makeIntake()])
      expect(mockNil.reason).toHaveBeenCalledWith(
        expect.objectContaining({ useCase: 'assess_intake_urgency' }),
      )
    })
  })

  describe('prioritizeBucketed', () => {
    it('returns two buckets for intakes + work items', async () => {
      const engine = createPrioritizationEngine(null)
      const intakes = [makeIntake()]
      const items = [makeWorkItem()]
      const buckets = await engine.prioritizeBucketed('org-1', intakes, items)
      expect(buckets).toHaveLength(2)
      expect(buckets[0]!.bucket).toBe('intake_review')
      expect(buckets[1]!.bucket).toBe('active_cases')
    })

    it('returns only active_cases if no intakes', async () => {
      const engine = createPrioritizationEngine(null)
      const buckets = await engine.prioritizeBucketed('org-1', [], [makeWorkItem()])
      expect(buckets).toHaveLength(1)
      expect(buckets[0]!.bucket).toBe('active_cases')
    })

    it('returns only intake_review if no work items', async () => {
      const engine = createPrioritizationEngine(null)
      const buckets = await engine.prioritizeBucketed('org-1', [makeIntake()], [])
      expect(buckets).toHaveLength(1)
      expect(buckets[0]!.bucket).toBe('intake_review')
    })

    it('intake bucket items include "awaiting rep review" factor', async () => {
      const engine = createPrioritizationEngine(null)
      const buckets = await engine.prioritizeBucketed('org-1', [makeIntake()], [])
      expect(buckets[0]!.items[0]!.contributingFactors).toContain(
        'Intake submission — awaiting rep review',
      )
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// SECTION 5: NIL Prompt Family
// ═══════════════════════════════════════════════════════════════════

describe('NIL prompt registry', () => {
  it('builds a valid IntelligenceRequest', () => {
    const registry = createPromptRegistry()
    const req = registry.buildRequest({
      family: IntakePromptFamilies.ASSESS_INTAKE_URGENCY,
      orgId: 'org-1',
      input: { intake: makeIntake() },
    })
    expect(req.orgId).toBe('org-1')
    expect(req.app).toBe('ue')
    expect(req.useCase).toBe('assess_intake_urgency')
    expect(req.input).toHaveProperty('promptVersion', '1.0.0')
  })

  it('correctly classifies intake families', () => {
    const registry = createPromptRegistry()
    expect(registry.isIntakeFamily('assess_intake_urgency')).toBe(true)
    expect(registry.isIntakeFamily('summarize_member_submission')).toBe(true)
    expect(registry.isIntakeFamily('prioritize_workload_item')).toBe(false)
  })

  it('correctly classifies case families', () => {
    const registry = createPromptRegistry()
    expect(registry.isCaseFamily('prioritize_workload_item')).toBe(true)
    expect(registry.isCaseFamily('rank_daily_work_queue')).toBe(true)
    expect(registry.isCaseFamily('assess_intake_urgency')).toBe(false)
  })

  it('has 4 intake prompts and 5 case prompts', () => {
    expect(Object.keys(IntakePromptFamilies)).toHaveLength(4)
    expect(Object.keys(CasePromptFamilies)).toHaveLength(5)
  })
})

// ═══════════════════════════════════════════════════════════════════
// SECTION 9: Human Override Model
// ═══════════════════════════════════════════════════════════════════

describe('override manager', () => {
  const manager = createOverrideManager()

  it('allows chief_steward to override priority', () => {
    const result = manager.applyOverride({
      workItemId: 'item-1',
      orgId: 'org-1',
      actorId: 'user-1',
      actorRole: 'chief_steward',
      previousLevel: 'medium',
      previousScore: 0.45,
      newLevel: 'critical',
      reason: 'Arbitration deadline approaching — must escalate immediately',
    })
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.overrideId).toBeTruthy()
      expect(result.newLevel).toBe('critical')
      expect(result.previousLevel).toBe('medium')
    }
  })

  it('rejects override from steward (below chief_steward)', () => {
    const result = manager.applyOverride({
      workItemId: 'item-1',
      orgId: 'org-1',
      actorId: 'user-1',
      actorRole: 'steward',
      previousLevel: 'low',
      previousScore: 0.2,
      newLevel: 'high',
      reason: 'I think this is more important',
    })
    expect('error' in result).toBe(true)
  })

  it('rejects override from member', () => {
    const result = manager.applyOverride({
      workItemId: 'item-1',
      orgId: 'org-1',
      actorId: 'user-1',
      actorRole: 'member',
      previousLevel: 'low',
      previousScore: 0.1,
      newLevel: 'high',
      reason: 'Want it higher',
    })
    expect('error' in result).toBe(true)
  })

  it('rejects override with too-short reason', () => {
    const result = manager.applyOverride({
      workItemId: 'item-1',
      orgId: 'org-1',
      actorId: 'user-1',
      actorRole: 'admin',
      previousLevel: 'low',
      previousScore: 0.2,
      newLevel: 'high',
      reason: 'short',
    })
    expect('error' in result).toBe(true)
  })

  it('rejects no-op override (same level)', () => {
    const result = manager.applyOverride({
      workItemId: 'item-1',
      orgId: 'org-1',
      actorId: 'user-1',
      actorRole: 'admin',
      previousLevel: 'high',
      previousScore: 0.6,
      newLevel: 'high',
      reason: 'This should stay high priority because of upcoming hearing',
    })
    expect('error' in result).toBe(true)
  })

  it('includes audit trail in successful override', () => {
    const result = manager.applyOverride({
      workItemId: 'item-1',
      orgId: 'org-1',
      actorId: 'user-chief',
      actorRole: 'president',
      previousLevel: 'low',
      previousScore: 0.15,
      newLevel: 'critical',
      reason: 'Member safety at risk — immediate action required per local president',
    })
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.overriddenBy).toBe('user-chief')
      expect(result.overriddenByRole).toBe('president')
      expect(result.overriddenAt).toBeTruthy()
    }
  })
})
