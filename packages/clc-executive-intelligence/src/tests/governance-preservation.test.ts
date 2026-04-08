/**
 * Governance Preservation — Unit Tests
 *
 * Verifies that the executive intelligence layer ONLY consumes
 * governed outputs from the decision-intelligence pipeline. No
 * raw data, consent, cohort, or permission logic touches this layer.
 */
import { describe, it, expect } from 'vitest';
import { runExecutiveIntelligencePipeline } from '../pipeline/index';
import { makeDecisionOutput, makeHeightenedOutput, makeSnapshot } from './fixtures';

describe('governance preservation', () => {
  it('pipeline does not expose raw data — only governed outputs', async () => {
    const output = makeHeightenedOutput();
    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: output,
      previousSnapshot: null,
    });

    // Verify: no raw DB references, no member names, no individual counts
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('SELECT');
    expect(serialized).not.toContain('INSERT');
    expect(serialized).not.toContain('member_name');
    expect(serialized).not.toContain('individual_count');
    expect(serialized).not.toContain('organization_id');
  });

  it('audit context is always populated', async () => {
    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: makeHeightenedOutput(),
      previousSnapshot: null,
    });

    expect(result.auditContext.executiveSummaryGenerated).toBe(true);
    expect(typeof result.auditContext.nilInvoked).toBe('boolean');
    expect(typeof result.auditContext.topPriorityCount).toBe('number');
    expect(typeof result.auditContext.changedSignalsCount).toBe('number');
    expect(typeof result.auditContext.usedTimeSeries).toBe('boolean');
  });

  it('previousSnapshotId is tracked when delta comparison occurs', async () => {
    const previous = makeSnapshot({ id: 'SNAP-GOV-001' });
    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: makeHeightenedOutput(),
      previousSnapshot: previous,
    });

    expect(result.auditContext.previousSnapshotId).toBe('SNAP-GOV-001');
  });

  it('nilInvoked is false when no NIL service', async () => {
    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: makeHeightenedOutput(),
      previousSnapshot: null,
    });

    expect(result.auditContext.nilInvoked).toBe(false);
    expect(result.actionBrief.nilInvoked).toBe(false);
  });

  it('all prompt contracts include anonymization rules', async () => {
    const { EXECUTIVE_PROMPT_CONTRACTS } = await import('../narrative/index');

    for (const contract of EXECUTIVE_PROMPT_CONTRACTS) {
      expect(contract.anonymizationRules.length).toBeGreaterThan(0);
      expect(
        contract.anonymizationRules.some((r: string) => r.toLowerCase().includes('individual')),
      ).toBe(true);
    }
  });

  it('priorities only reference governed aggregate data', async () => {
    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: makeHeightenedOutput(),
      previousSnapshot: null,
    });

    for (const priority of result.topExecutivePriorities) {
      // Evidence refs should be pattern/recommendation refs, not raw data
      for (const ref of priority.evidenceRefs) {
        expect(ref).toMatch(/^(ref:|pattern:|recommendation:)/);
      }
    }
  });

  it('snapshot does not contain raw data — only aggregate state', async () => {
    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: makeHeightenedOutput(),
      previousSnapshot: null,
    });

    const snap = result.currentSnapshot;
    expect(snap.id).toMatch(/^SNAP-/);
    expect(snap.activePatternIds.length).toBeGreaterThan(0);
    // Pattern IDs, not raw org data
    for (const id of snap.activePatternIds) {
      expect(id).toMatch(/^P\d+$|^bargaining-/);
    }
  });

  it('movement summary does not leak individual affiliate data', async () => {
    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: makeHeightenedOutput(),
      previousSnapshot: null,
    });

    const summaryText = result.movementSummary.headline + result.movementSummary.summary;
    expect(summaryText).not.toContain('individual');
    expect(summaryText).not.toContain('member_id');
    expect(summaryText).not.toContain('employee');
  });
});
