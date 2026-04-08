/**
 * Pipeline Orchestrator — Unit Tests
 *
 * Tests: full pipeline run, NIL integration, time-series effects,
 * audit context, snapshot generation.
 */
import { describe, it, expect, vi } from 'vitest';
import type { NilReasoningService } from '../contracts/index';
import { runExecutiveIntelligencePipeline } from '../pipeline/index';
import { makeDecisionOutput, makeHeightenedOutput, makeSnapshot } from './fixtures';

describe('pipeline orchestrator', () => {
  it('runs full pipeline with no previous snapshot and no NIL', async () => {
    const output = makeHeightenedOutput();
    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: output,
      previousSnapshot: null,
    });

    expect(result.movementSummary).toBeDefined();
    expect(result.movementSummary.posture).toBeTruthy();
    expect(result.movementSummary.headline).toBeTruthy();

    expect(result.topExecutivePriorities.length).toBeGreaterThan(0);
    expect(result.topExecutivePriorities.length).toBeLessThanOrEqual(5);

    // No previous snapshot = no deltas
    expect(result.whatChanged).toEqual([]);

    expect(result.actionBrief).toBeDefined();
    expect(result.actionBrief.generatedAt).toBeTruthy();
    expect(result.actionBrief.nilInvoked).toBe(false);
    expect(result.actionBrief.headline).toBeTruthy();
    expect(result.actionBrief.summary).toBeTruthy();
    expect(result.actionBrief.recommendedNextSteps.length).toBeGreaterThan(0);

    expect(result.currentSnapshot).toBeDefined();
    expect(result.currentSnapshot.id).toMatch(/^SNAP-/);

    expect(result.auditContext.executiveSummaryGenerated).toBe(true);
    expect(result.auditContext.nilInvoked).toBe(false);
  });

  it('detects deltas when previous snapshot exists', async () => {
    const output = makeHeightenedOutput();
    const previous = makeSnapshot({
      posture: 'steady',
      activePatternIds: ['P1'],
      patternWatchLevels: { P1: 'elevated' },
      bargainingWatchActive: false,
    });

    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: output,
      previousSnapshot: previous,
    });

    expect(result.whatChanged.length).toBeGreaterThan(0);
    expect(result.auditContext.changedSignalsCount).toBeGreaterThan(0);
    expect(result.auditContext.previousSnapshotId).toBe('SNAP-TEST-001');
  });

  it('tracks nilInvoked=true when NIL service is available', async () => {
    const service: NilReasoningService = {
      isAvailable: () => true,
      refine: vi.fn().mockResolvedValue({
        headline: 'NIL-refined headline',
        summary: 'NIL-refined summary',
        keyTakeaway: 'Key insight from NIL',
      }),
    };

    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: makeHeightenedOutput(),
      previousSnapshot: null,
      nilService: service,
    });

    expect(result.auditContext.nilInvoked).toBe(true);
    expect(result.actionBrief.nilInvoked).toBe(true);
    // NIL refinement should be applied
    expect(service.refine).toHaveBeenCalled();
  });

  it('falls back gracefully when NIL fails', async () => {
    const service: NilReasoningService = {
      isAvailable: () => true,
      refine: vi.fn().mockRejectedValue(new Error('NIL offline')),
    };

    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: makeHeightenedOutput(),
      previousSnapshot: null,
      nilService: service,
    });

    // Should still succeed with deterministic fallback
    expect(result.actionBrief).toBeDefined();
    expect(result.actionBrief.headline).toBeTruthy();
    expect(result.actionBrief.summary).toBeTruthy();
    expect(result.auditContext.nilInvoked).toBe(true);
  });

  it('respects maxPriorities parameter', async () => {
    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: makeHeightenedOutput(),
      previousSnapshot: null,
      maxPriorities: 2,
    });

    expect(result.topExecutivePriorities.length).toBeLessThanOrEqual(2);
    expect(result.auditContext.topPriorityCount).toBeLessThanOrEqual(2);
  });

  it('records timeSeriesAvailable in audit context', async () => {
    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: makeHeightenedOutput(),
      previousSnapshot: null,
      timeSeriesAvailable: true,
    });

    expect(result.auditContext.usedTimeSeries).toBe(true);
    expect(result.actionBrief.usedTimeSeries).toBe(true);
  });

  it('handles empty decision output gracefully', async () => {
    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: makeDecisionOutput(),
      previousSnapshot: null,
    });

    expect(result.topExecutivePriorities).toEqual([]);
    expect(result.movementSummary.posture).toBe('steady');
    expect(result.actionBrief).toBeDefined();
    expect(result.currentSnapshot).toBeDefined();
  });

  it('snapshot contains topPriorityIds from ranked priorities', async () => {
    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: makeHeightenedOutput(),
      previousSnapshot: null,
    });

    const priorityIds = result.topExecutivePriorities.map((p) => p.id);
    expect(result.currentSnapshot.topPriorityIds).toEqual(priorityIds);
  });

  it('evidence refs are collected from priorities and patterns', async () => {
    const result = await runExecutiveIntelligencePipeline({
      decisionOutput: makeHeightenedOutput(),
      previousSnapshot: null,
    });

    expect(result.actionBrief.evidenceRefs.length).toBeGreaterThan(0);
  });
});
