import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
const { withRLSContext } = vi.hoisted(() => ({ withRLSContext: vi.fn() }));
const { audit } = vi.hoisted(() => ({ audit: vi.fn() }));
const { calculateResilienceIndex } = vi.hoisted(() => ({ calculateResilienceIndex: vi.fn() }));
const { simulateContinuityImpact } = vi.hoisted(() => ({ simulateContinuityImpact: vi.fn() }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit }));
vi.mock('../../resilience-index/resilience-calculator', () => ({ calculateResilienceIndex }));
vi.mock('../../simulation/continuity-simulator', () => ({ simulateContinuityImpact }));
vi.mock('../../governance/interview-access', () => ({ derivedAnalyticsCondition: () => 'derived-analytics-condition' }));
vi.mock('drizzle-orm', () => ({
  sql: Object.assign((..._a: unknown[]) => ({}), { raw: (s: string) => s }),
}));

import {
  saveCognitionMemory,
  loadCognitionMemory,
  archiveCognitionMemory,
  getCognitionMemoryEntry,
} from '../memory-store';


const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const E1 = '33333333-3333-4333-8333-333333333333';
const E2 = '44444444-4444-4444-8444-444444444444';
const USER = 'user-1';

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue([]);
  withRLSContext.mockReset();
  audit.mockReset();
  audit.mockResolvedValue(undefined);
  calculateResilienceIndex.mockReset();
  withRLSContext.mockImplementation(async (_ctx: unknown, op: (tx: unknown) => unknown) => op({ execute }));
});

describe('lib/knowledge-transfer/cognition-memory/memory-store', () => {
  it('saveCognitionMemory inserts inside the tenant context, returning the entry', async () => {
    const entry = await saveCognitionMemory(ORG, {
      memoryType: 'governance_reasoning',
      title: 'Decision',
      contextSummary: 'ctx',
      payload: { a: 1 },
      resilienceScoreAtCapture: 55,
      tags: ['gov'],
      keyInsights: ['insight'],
      sessionId: 'sess-1',
    } as never, USER);
    expect(entry.organizationId).toBe(ORG);
    expect(entry.title).toBe('Decision');
    expect(entry.status).toBe('active');
    expect(entry.id).toBeDefined();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(withRLSContext).toHaveBeenCalledWith({ organizationId: ORG }, expect.any(Function));
    // Only a resilience_baseline entry is cross-checked against a measured index - a governance_reasoning entry's
    // own typed score is not resilience data to compare.
    expect(calculateResilienceIndex).not.toHaveBeenCalled();
    expect(entry.algorithmComputedResilienceIndexAtCapture).toBeNull();
  });

  it('saveCognitionMemory applies defaults for optional fields', async () => {
    const entry = await saveCognitionMemory(ORG, { memoryType: 'memory_captured', title: 'X' } as never, USER);
    expect(entry.contextSummary).toBe('');
    expect(entry.tags).toEqual([]);
    expect(entry.resilienceScoreAtCapture).toBeNull();
    expect(entry.sessionId).toBeNull();
    expect(calculateResilienceIndex).not.toHaveBeenCalled();
  });

  // DEF-0B7-EXC-COGNITION-MEMORY-STORES-CALLER-ASSERTED-SNAPSHOTS-WITH-NO-AUTHOR: a resilience_baseline entry's
  // typed score is now returned alongside the independently measured index for the same organization.
  describe('resilience_baseline measured-index cross-check', () => {
    it('attaches the measured resilience index alongside the officer-typed score', async () => {
      calculateResilienceIndex.mockResolvedValue({ overallScore: 62 });
      const entry = await saveCognitionMemory(ORG, {
        memoryType: 'resilience_baseline', title: 'Baseline', resilienceScoreAtCapture: 80,
      } as never, USER);
      expect(calculateResilienceIndex).toHaveBeenCalledWith(ORG);
      expect(entry.resilienceScoreAtCapture).toBe(80);
      expect(entry.algorithmComputedResilienceIndexAtCapture).toBe(62);
    });

    it('does not compute a measured index when no score was typed', async () => {
      const entry = await saveCognitionMemory(ORG, {
        memoryType: 'resilience_baseline', title: 'Baseline',
      } as never, USER);
      expect(calculateResilienceIndex).not.toHaveBeenCalled();
      expect(entry.algorithmComputedResilienceIndexAtCapture).toBeNull();
    });

    it('saves the officer-typed score even when no measured index can be computed yet', async () => {
      calculateResilienceIndex.mockRejectedValue(new Error('no dependency data'));
      const entry = await saveCognitionMemory(ORG, {
        memoryType: 'resilience_baseline', title: 'Baseline', resilienceScoreAtCapture: 80,
      } as never, USER);
      expect(entry.resilienceScoreAtCapture).toBe(80);
      expect(entry.algorithmComputedResilienceIndexAtCapture).toBeNull();
      // The save itself is unaffected by the measured index being unavailable.
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });

  // DEF-0B7-EXC-COGNITION-MEMORY-STORES-CALLER-ASSERTED-SNAPSHOTS-WITH-NO-AUTHOR: a simulation_snapshot given a
  // scenario is never the officer's own stated result - the server runs the real simulation workflow itself.
  describe('simulation_snapshot dual provenance', () => {
    const SCENARIO = { simulationType: 'retirement' as const, affectedNodeIds: ['n1', 'n2'] };
    const SIMULATION_RESULT = {
      organizationId: ORG,
      generatedAt: '2026-01-01T00:00:00.000Z',
      scenario: SCENARIO,
      baselineContinuityScore: 70,
      immediateImpactScore: 55.4,
      twelveWeekProjection: 60,
      overallImpactSeverity: 'high' as const,
      domainImpacts: [],
      degradationTimeline: [],
      exacerbatedWeaknesses: [],
      immediateActions: [],
      mitigation30Day: [],
      remediation90Day: [],
      recoveryEffortEstimate: 'medium' as const,
      autonomousRecoveryProbability: 0.4,
      governanceBodiesAffected: 0,
      complianceRiskCreated: false,
      executiveSummary: 'summary',
    };

    it('runs the real simulation workflow and persists a system_generated entry when a scenario is given', async () => {
      simulateContinuityImpact.mockResolvedValue(SIMULATION_RESULT);
      execute.mockResolvedValueOnce([{ id: 'interview-1' }, { id: 'interview-2' }]); // currentEvidenceIds
      execute.mockResolvedValueOnce(undefined); // the INSERT itself

      const entry = await saveCognitionMemory(ORG, {
        memoryType: 'simulation_snapshot',
        title: 'Retirement wave',
        contextSummary: '',
        payload: { officerNote: 'this should be ignored' },
        scenario: SCENARIO,
      } as never, USER);

      expect(simulateContinuityImpact).toHaveBeenCalledWith(ORG, SCENARIO);
      expect(entry.provenance).toMatchObject({
        source: 'system_generated',
        recordedBy: USER,
        workflow: 'simulateContinuityImpact',
        scenario: SCENARIO,
        inputEvidenceIds: ['interview-1', 'interview-2'],
      });
      // The real result is the payload - the officer's own payload for this call is never stored.
      expect(entry.payload).not.toHaveProperty('officerNote');
      expect(entry.payload).toMatchObject({ executiveSummary: 'summary' });
      // The result's own immediateImpactScore is the resilience figure, not an officer's guess.
      expect(entry.resilienceScoreAtCapture).toBe(55);
    });

    it('saves an officer-typed simulation_snapshot as officer_asserted when no scenario is given', async () => {
      const entry = await saveCognitionMemory(ORG, {
        memoryType: 'simulation_snapshot',
        title: 'My own notes on a retirement',
        contextSummary: '',
        payload: { note: 'officer wrote this' },
      } as never, USER);

      expect(simulateContinuityImpact).not.toHaveBeenCalled();
      expect(entry.provenance).toEqual({ source: 'officer_asserted', recordedBy: USER });
      expect(entry.payload).toEqual({ note: 'officer wrote this' });
    });

    it('reports historical verification as unavailable for an officer_asserted simulation_snapshot read back from storage', async () => {
      execute.mockResolvedValueOnce([
        {
          id: 'r1', organization_id: ORG, memory_type: 'simulation_snapshot', title: 'Old snapshot',
          payload: { note: 'typed in', __provenance: { source: 'officer_asserted', recordedBy: 'u1' } },
          resilience_score_at_capture: null, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z',
        },
      ]);
      const store = await loadCognitionMemory(ORG, {});
      expect(store.entries[0].historicalVerification).toEqual({
        checked: true,
        reconcilable: false,
        reason: 'scenario_not_reconstructable',
      });
    });

    it('reports historical verification as predating provenance tracking when the stored payload has no provenance key at all', async () => {
      execute.mockResolvedValueOnce([
        {
          id: 'r1', organization_id: ORG, memory_type: 'simulation_snapshot', title: 'Very old snapshot',
          payload: { note: 'typed in before provenance existed' },
          resilience_score_at_capture: null, created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z',
        },
      ]);
      const store = await loadCognitionMemory(ORG, {});
      expect(store.entries[0].historicalVerification).toEqual({
        checked: true,
        reconcilable: false,
        reason: 'predates_provenance_tracking',
      });
    });

    it('reports historical verification as not_applicable for a system_generated entry read back from storage', async () => {
      execute.mockResolvedValueOnce([
        {
          id: 'r1', organization_id: ORG, memory_type: 'simulation_snapshot', title: 'Real run',
          payload: {
            executiveSummary: 'x',
            __provenance: {
              source: 'system_generated', recordedBy: 'u1', workflow: 'simulateContinuityImpact',
              modelVersion: 'continuity-simulator-v1', scenario: SCENARIO, computedAt: '2026-01-01T00:00:00.000Z', inputEvidenceIds: ['i1'],
            },
          },
          resilience_score_at_capture: 55, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
        },
      ]);
      const store = await loadCognitionMemory(ORG, {});
      expect(store.entries[0].provenance?.source).toBe('system_generated');
      expect(store.entries[0].historicalVerification).toEqual({ checked: true, reconcilable: true, reason: 'not_applicable' });
    });

    // Decision 1 adversarial follow-up: a capture-time algorithm-computed figure must survive a reload, not merely
    // appear on the response to the save call that produced it.
    it('returns the algorithm-computed resilience index from a prior save on a later read, unchanged', async () => {
      execute.mockResolvedValueOnce([
        {
          id: 'r1', organization_id: ORG, memory_type: 'resilience_baseline', title: 'Baseline',
          payload: {
            __provenance: { source: 'officer_asserted', recordedBy: 'u1' },
            __algorithmComputedResilienceIndexAtCapture: 62,
          },
          resilience_score_at_capture: 80, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
        },
      ]);
      const store = await loadCognitionMemory(ORG, {});
      expect(store.entries[0].resilienceScoreAtCapture).toBe(80);
      expect(store.entries[0].algorithmComputedResilienceIndexAtCapture).toBe(62);
      // The reserved key never leaks into the officer-visible payload.
      expect(store.entries[0].payload).not.toHaveProperty('__algorithmComputedResilienceIndexAtCapture');
    });
  });

  it('loadCognitionMemory maps rows and builds a resilience timeline', async () => {
    const rows = [
      {
        id: 'r1', organization_id: ORG, memory_type: 'resilience_baseline', title: 'A',
        context_summary: 'c', payload: { x: 1 }, resilience_score_at_capture: 50,
        tags: ['t'], key_insights: ['k'], session_id: 's1', status: 'active',
        created_at: { toISOString: () => '2025-01-01T00:00:00.000Z' },
        updated_at: { toISOString: () => '2025-01-01T00:00:00.000Z' },
      },
      {
        id: 'r2', organization_id: ORG, memory_type: 'resilience_baseline', title: 'B',
        resilience_score_at_capture: 58, created_at: '2025-01-05T00:00:00.000Z',
        updated_at: '2025-01-05T00:00:00.000Z',
      },
      {
        id: 'r3', organization_id: ORG, memory_type: 'decision_brief', title: 'C',
        resilience_score_at_capture: null, created_at: '2025-01-03T00:00:00.000Z',
        updated_at: '2025-01-03T00:00:00.000Z',
      },
    ];
    execute.mockResolvedValue(rows);
    const store = await loadCognitionMemory(ORG, { limit: 10, memoryType: 'resilience_baseline', sessionId: 's1' });
    expect(store.totalEntries).toBe(3);
    expect(store.resilienceTimeline.length).toBe(2);
    expect(store.resilienceTimeline[0].changeFromPrevious).toBeNull();
    expect(store.resilienceTimeline[1].changeFromPrevious).toBe(8);
    // defaulted fields on sparse row
    const r2 = store.entries.find((e) => e.id === 'r2');
    expect(r2?.contextSummary).toBe('');
    expect(r2?.tags).toEqual([]);
  });

  it('loadCognitionMemory works with no filter options', async () => {
    execute.mockResolvedValue([]);
    const store = await loadCognitionMemory(ORG);
    expect(store.entries).toEqual([]);
    expect(store.resilienceTimeline).toEqual([]);
  });

  it('archiveCognitionMemory audits an archived entry on the same transaction', async () => {
    execute.mockResolvedValue([{ id: E1 }]);
    expect(await archiveCognitionMemory(ORG, E1, USER)).toBe(true);
    expect(audit).toHaveBeenCalledWith({ execute }, expect.objectContaining({ organizationId: ORG, userId: USER, action: 'cognition_memory.archive', resourceId: E1 }));
  });

  it('archiveCognitionMemory matching nothing (missing, other organization, already archived) audits nothing', async () => {
    execute.mockResolvedValue([]);
    expect(await archiveCognitionMemory(ORG, E1, USER)).toBe(false);
    expect(audit).not.toHaveBeenCalled();
  });

  it('saveCognitionMemory audits on the same transaction and fails when the audit fails', async () => {
    await saveCognitionMemory(ORG, { memoryType: 'decision_brief', title: 'T' } as never, USER);
    expect(audit).toHaveBeenCalledWith({ execute }, expect.objectContaining({ organizationId: ORG, userId: USER, action: 'cognition_memory.save' }));
    audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(saveCognitionMemory(ORG, { memoryType: 'decision_brief', title: 'T' } as never, USER)).rejects.toThrow('audit down');
  });

  it('getCognitionMemoryEntry returns entry when found', async () => {
    execute.mockResolvedValue([
      { id: E1, organization_id: ORG, memory_type: 'decision_brief', title: 'A', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
    ]);
    const entry = await getCognitionMemoryEntry(ORG, E1);
    expect(entry?.id).toBe(E1);
  });

  it('getCognitionMemoryEntry returns null when not found', async () => {
    execute.mockResolvedValue([]);
    const entry = await getCognitionMemoryEntry(ORG, E2);
    expect(entry).toBeNull();
  });

  it('runs every operation inside the organization tenant context', async () => {
    await loadCognitionMemory(OTHER_ORG);
    await archiveCognitionMemory(OTHER_ORG, E1, USER);
    await getCognitionMemoryEntry(OTHER_ORG, E1);
    await saveCognitionMemory(OTHER_ORG, { memoryType: 'decision_brief', title: 'T' } as never, USER);
    expect(withRLSContext).toHaveBeenCalledTimes(4);
    for (const call of withRLSContext.mock.calls) {
      expect(call[0]).toEqual({ organizationId: OTHER_ORG });
    }
  });

  it('refuses a non-UUID organization before touching the database', async () => {
    await expect(loadCognitionMemory('org-1')).rejects.toThrow('organizationId must be a UUID');
    await expect(saveCognitionMemory('org-1', { memoryType: 'decision_brief', title: 'T' } as never, USER)).rejects.toThrow();
    expect(withRLSContext).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('treats a malformed entry id as matching nothing without querying', async () => {
    expect(await getCognitionMemoryEntry(ORG, 'not-a-uuid')).toBeNull();
    expect(await archiveCognitionMemory(ORG, 'not-a-uuid', USER)).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('never issues schema DDL', () => {
    const source = readFileSync(fileURLToPath(new URL('../memory-store.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/CREATE\s+(TABLE|INDEX)|ALTER\s+TABLE|ensureTable/i);
  });
});