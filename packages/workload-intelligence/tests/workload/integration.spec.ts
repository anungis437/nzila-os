import { describe, it, expect, vi } from 'vitest'

// ─── Imports under test ──────────────────────────────────────────
import { createPrioritizationEngine } from '../../src/engine/prioritizationEngine.js'
import { createPromptRegistry, IntakePromptFamilies, CasePromptFamilies } from '../../src/prompts/promptRegistry.js'
import { createOverrideManager } from '../../src/overrides/overrideManager.js'
import { createIntakeWorkflow, isTerminalIntakeStatus } from '../../src/workflow/intakeLifecycle.js'
import {
  canCreateIntake,
  canCreateOfficialWorkItem,
  canConvertIntake,
  canOverridePriority,
} from '../../src/authority/permissions.js'
import type { IntakeSubmission, WorkItem } from '../../src/models/types.js'

// ─── Helpers ─────────────────────────────────────────────────────

function makeIntake(overrides: Partial<IntakeSubmission> = {}): IntakeSubmission {
  return {
    id: 'intake-1',
    orgId: 'org-1',
    submittedByMemberId: 'member-1',
    title: 'Unsafe conditions on Line 3',
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
// F-7: PrioritizedIntake uses reviewUrgency (not priorityLevel)
// ═══════════════════════════════════════════════════════════════════

describe('PrioritizedIntake reviewUrgency field', () => {
  it('returns reviewUrgency on intake results', async () => {
    const engine = createPrioritizationEngine(null)
    const result = await engine.prioritizeIntakes('org-1', [makeIntake()])
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveProperty('reviewUrgency')
    expect(result[0]).not.toHaveProperty('priorityLevel')
  })

  it('reviewUrgency is a valid priority level string', async () => {
    const engine = createPrioritizationEngine(null)
    const result = await engine.prioritizeIntakes('org-1', [makeIntake()])
    expect(['critical', 'high', 'medium', 'low']).toContain(result[0]!.reviewUrgency)
  })
})

// ═══════════════════════════════════════════════════════════════════
// F-11: Prompt versioning
// ═══════════════════════════════════════════════════════════════════

describe('prompt versioning', () => {
  it('IntakePromptFamilies entries have family and version', () => {
    for (const entry of Object.values(IntakePromptFamilies)) {
      expect(entry).toHaveProperty('family')
      expect(entry).toHaveProperty('version')
      expect(typeof entry.family).toBe('string')
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })

  it('CasePromptFamilies entries have family and version', () => {
    for (const entry of Object.values(CasePromptFamilies)) {
      expect(entry).toHaveProperty('family')
      expect(entry).toHaveProperty('version')
      expect(typeof entry.family).toBe('string')
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })

  it('buildRequest includes promptVersion in input', () => {
    const registry = createPromptRegistry()
    const req = registry.buildRequest({
      family: IntakePromptFamilies.ASSESS_INTAKE_URGENCY,
      orgId: 'org-1',
      input: { intake: makeIntake() },
    })
    expect(req.input).toHaveProperty('promptVersion', '1.0.0')
  })
})

// ═══════════════════════════════════════════════════════════════════
// F-12: Prompt registry wired into engine
// ═══════════════════════════════════════════════════════════════════

describe('prompt registry wired into engine', () => {
  it('engine uses assess_intake_urgency for intakes via registry', async () => {
    const mockNil = {
      reason: vi.fn().mockResolvedValue({
        success: true,
        explanation: { summary: 'Urgent' },
        confidence: 0.8,
      }),
    }
    const engine = createPrioritizationEngine(mockNil)
    await engine.prioritizeIntakes('org-1', [makeIntake()])
    expect(mockNil.reason).toHaveBeenCalledWith(
      expect.objectContaining({
        useCase: 'assess_intake_urgency',
        input: expect.objectContaining({ promptVersion: '1.0.0' }),
      }),
    )
  })

  it('engine uses prioritize_workload_item for cases via registry', async () => {
    const mockNil = {
      reason: vi.fn().mockResolvedValue({
        success: true,
        explanation: { summary: 'Important' },
        confidence: 0.85,
      }),
    }
    const engine = createPrioritizationEngine(mockNil)
    await engine.prioritize('org-1', [makeWorkItem()])
    expect(mockNil.reason).toHaveBeenCalledWith(
      expect.objectContaining({
        useCase: 'prioritize_workload_item',
        input: expect.objectContaining({ promptVersion: '1.0.0' }),
      }),
    )
  })
})

// ═══════════════════════════════════════════════════════════════════
// F-13: Pin / Defer override operations
// ═══════════════════════════════════════════════════════════════════

describe('override manager pin/defer', () => {
  const manager = createOverrideManager()

  describe('pinItem', () => {
    it('allows chief_steward to pin an item', () => {
      const result = manager.pinItem({
        workItemId: 'item-1',
        orgId: 'org-1',
        actorId: 'user-chief',
        actorRole: 'chief_steward',
        currentLevel: 'high',
        currentScore: 0.7,
        reason: 'Keep this at top of queue — hearing next week',
      })
      expect('error' in result).toBe(false)
      if (!('error' in result)) {
        expect(result.operation).toBe('pin')
        expect(result.previousLevel).toBe('high')
        expect(result.newLevel).toBe('high') // pin keeps same level
      }
    })

    it('rejects pin from steward', () => {
      const result = manager.pinItem({
        workItemId: 'item-1',
        orgId: 'org-1',
        actorId: 'user-1',
        actorRole: 'steward',
        currentLevel: 'medium',
        currentScore: 0.5,
        reason: 'I want to pin this item permanently',
      })
      expect('error' in result).toBe(true)
    })

    it('rejects pin with short reason', () => {
      const result = manager.pinItem({
        workItemId: 'item-1',
        orgId: 'org-1',
        actorId: 'user-chief',
        actorRole: 'chief_steward',
        currentLevel: 'high',
        currentScore: 0.7,
        reason: 'pin it',
      })
      expect('error' in result).toBe(true)
    })
  })

  describe('deferItem', () => {
    it('allows admin to defer an item to low priority', () => {
      const result = manager.deferItem({
        workItemId: 'item-1',
        orgId: 'org-1',
        actorId: 'user-admin',
        actorRole: 'admin',
        currentLevel: 'high',
        currentScore: 0.7,
        reason: 'Awaiting employer response — defer for now',
      })
      expect('error' in result).toBe(false)
      if (!('error' in result)) {
        expect(result.operation).toBe('defer')
        expect(result.newLevel).toBe('low')
        expect(result.previousLevel).toBe('high')
      }
    })

    it('rejects defer from member', () => {
      const result = manager.deferItem({
        workItemId: 'item-1',
        orgId: 'org-1',
        actorId: 'user-1',
        actorRole: 'member',
        currentLevel: 'medium',
        currentScore: 0.5,
        reason: 'I want to defer this work item',
      })
      expect('error' in result).toBe(true)
    })
  })

  describe('operation field', () => {
    it('applyOverride has operation=override', () => {
      const result = manager.applyOverride({
        workItemId: 'item-1',
        orgId: 'org-1',
        actorId: 'user-1',
        actorRole: 'chief_steward',
        previousLevel: 'low',
        previousScore: 0.2,
        newLevel: 'high',
        reason: 'Escalating because of safety concern identified',
      })
      expect('error' in result).toBe(false)
      if (!('error' in result)) {
        expect(result.operation).toBe('override')
      }
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// Authority enforcement integration
// ═══════════════════════════════════════════════════════════════════

describe('authority enforcement integration', () => {
  it('member can submit intake but not create official case', () => {
    expect(canCreateIntake('member')).toBe(true)
    expect(canCreateOfficialWorkItem('member')).toBe(false)
  })

  it('steward can do both', () => {
    expect(canCreateIntake('steward')).toBe(true)
    expect(canCreateOfficialWorkItem('steward')).toBe(true)
  })

  it('only chief_steward+ can override priorities', () => {
    expect(canOverridePriority('steward')).toBe(false)
    expect(canOverridePriority('chief_steward')).toBe(true)
  })

  it('conversion follows authority model', () => {
    expect(canConvertIntake('member')).toBe(false)
    expect(canConvertIntake('steward')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════
// End-to-end intake conversion workflow
// ═══════════════════════════════════════════════════════════════════

describe('intake conversion workflow (end-to-end)', () => {
  it('full lifecycle: new → under_review → converted', () => {
    const intake = makeIntake({ status: 'new' })

    // 1. Member submits
    expect(canCreateIntake('member')).toBe(true)

    // 2. Move to review
    const wf1 = createIntakeWorkflow(intake)
    const r1 = wf1.transition('under_review', 'steward')
    expect(r1.success).toBe(true)

    // 3. Rep converts
    const wf2 = createIntakeWorkflow({ ...intake, status: 'under_review' })
    const r2 = wf2.transition('converted', 'steward')
    expect(r2.success).toBe(true)
    expect(r2.newStatus).toBe('converted')

    // 4. Terminal — no further transitions
    expect(isTerminalIntakeStatus('converted')).toBe(true)
  })

  it('full lifecycle: new → under_review → closed_no_case', () => {
    const intake = makeIntake({ status: 'new' })

    const wf1 = createIntakeWorkflow(intake)
    const r1 = wf1.transition('under_review', 'steward')
    expect(r1.success).toBe(true)

    const wf2 = createIntakeWorkflow({ ...intake, status: 'under_review' })
    const r2 = wf2.transition('closed_no_case', 'steward')
    expect(r2.success).toBe(true)
    expect(r2.newStatus).toBe('closed_no_case')

    expect(isTerminalIntakeStatus('closed_no_case')).toBe(true)
  })

  it('member cannot bypass rep review to convert', () => {
    const wf = createIntakeWorkflow(makeIntake({ status: 'under_review' }))
    const result = wf.transition('converted', 'member')
    expect(result.success).toBe(false)
  })
})
