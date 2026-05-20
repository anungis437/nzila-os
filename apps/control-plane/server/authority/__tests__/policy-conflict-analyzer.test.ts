import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@nzila/os-core', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))
vi.mock('@nzila/db/schema', () => ({
  policyConflicts: { id: 'id', isActive: 'isActive', policyIdA: 'policyIdA' },
  governedPolicies: { id: 'id', lifecycleStatus: 'lifecycleStatus' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((c: unknown, v: unknown) => ({ c, v })),
  and: vi.fn((...a: unknown[]) => a),
  or: vi.fn((...a: unknown[]) => a),
  inArray: vi.fn((c: unknown, v: unknown) => ({ c, v })),
}))
vi.mock('../policy-governance-events-service', () => ({
  recordGovernanceEvent: vi.fn().mockResolvedValue({}),
}))

import { analyzeConflicts, scoreConflictSeverity } from '../policy-conflict-analyzer'
import type { GovernedPolicyRow } from '@nzila/db/schema'

function makePolicy(overrides: Partial<GovernedPolicyRow>): GovernedPolicyRow {
  return {
    id: 'pol-default',
    policyFamilyId: 'fam-1',
    semver: '1.0.0',
    name: 'Default Policy',
    domain: 'governance',
    lifecycleStatus: 'active',
    riskClassification: 'medium',
    workflowBindings: [],
    operationalScope: {},
    governanceRationale: 'Test.',
    reviewCadenceDays: 365,
    replayCompatibilityVersion: '1',
    authorId: 'user-1',
    authorRole: 'admin',
    orgId: null,
    ownerUserId: null,
    contentHash: null,
    integritySignature: null,
    supersededBy: null,
    effectiveFrom: null,
    effectiveUntil: null,
    publishedAt: null,
    activatedAt: null,
    deprecatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GovernedPolicyRow
}

describe('policy-conflict-analyzer — analyzeConflicts (pure function)', () => {
  it('returns empty array for empty policy list', () => {
    expect(analyzeConflicts([])).toEqual([])
  })

  it('returns empty array for a single policy', () => {
    const policy = makePolicy({
      id: 'pol-1',
      workflowBindings: ['wf-001'],
    })
    expect(analyzeConflicts([policy])).toEqual([])
  })

  it('detects workflow_binding conflict when two cross-domain policies share a workflow', () => {
    const p1 = makePolicy({ id: 'pol-1', domain: 'governance', workflowBindings: ['wf-shared'] })
    const p2 = makePolicy({ id: 'pol-2', domain: 'commerce', workflowBindings: ['wf-shared'] })
    const reports = analyzeConflicts([p1, p2])
    const binding = reports.find((r) => r.conflictType === 'workflow_binding')
    expect(binding).toBeDefined()
    expect(binding!.severity).toBe('critical')
    expect(binding!.affectedWorkflowIds).toContain('wf-shared')
  })

  it('detects duplicate_ownership when two same-domain policies share a workflow', () => {
    const p1 = makePolicy({ id: 'pol-1', domain: 'governance', name: 'P1', workflowBindings: ['wf-a'] })
    const p2 = makePolicy({ id: 'pol-2', domain: 'governance', name: 'P2', workflowBindings: ['wf-a'] })
    const reports = analyzeConflicts([p1, p2])
    const dup = reports.find((r) => r.conflictType === 'duplicate_ownership')
    expect(dup).toBeDefined()
    expect(dup!.severity).toBe('error')
  })

  it('does not report conflict for policies with non-overlapping workflows', () => {
    const p1 = makePolicy({ id: 'pol-1', workflowBindings: ['wf-a'] })
    const p2 = makePolicy({ id: 'pol-2', workflowBindings: ['wf-b'] })
    expect(analyzeConflicts([p1, p2])).toEqual([])
  })
})

describe('scoreConflictSeverity', () => {
  it('returns critical for a cross-domain workflow_binding conflict', () => {
    const p = makePolicy({ id: 'pol-1', domain: 'governance', workflowBindings: ['wf-shared'] })
    const q = makePolicy({ id: 'pol-2', domain: 'commerce', workflowBindings: ['wf-shared'] })
    const reports = analyzeConflicts([p, q])
    const conflict = reports.find((r) => r.conflictType === 'workflow_binding')!
    expect(scoreConflictSeverity(conflict, [p, q])).toBe('critical')
  })

  it('returns error for a same-domain duplicate_ownership conflict', () => {
    const p = makePolicy({ id: 'pol-1', domain: 'governance', name: 'P1', workflowBindings: ['wf-a'] })
    const q = makePolicy({ id: 'pol-2', domain: 'governance', name: 'P2', workflowBindings: ['wf-a'] })
    const reports = analyzeConflicts([p, q])
    const conflict = reports.find((r) => r.conflictType === 'duplicate_ownership')!
    expect(scoreConflictSeverity(conflict, [p, q])).toBe('error')
  })
})
