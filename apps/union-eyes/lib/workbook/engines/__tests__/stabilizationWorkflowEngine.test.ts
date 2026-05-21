import { describe, expect, it } from 'vitest';
import {
  runStabilizationWorkflowEngine,
  ENGINE_VERSION,
  type StabilizationWorkflowEngineInput,
} from '@/lib/workbook/engines/workflows/stabilizationWorkflowEngine';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

const empty: StabilizationWorkflowEngineInput = {
  status: 'self-guided',
  stabilization: {
    densityIndex: 0,
    unsuccessedInstitutionCriticalCount: 0,
    unsuccessedLoadBearingCount: 0,
    undocumentedProcessCount: 0,
    singleCarrierProcessCount: 0,
    governanceDriftAggregate: 0,
    onboardingCriticalCount: 0,
    breakpointCriticalCount: 0,
  },
  redistribution: {
    status: 'self-guided',
    redistribution: { carriers: [], processes: [], lineageGaps: [] },
    reciprocityTermsRatified: false,
  },
  recovery: {
    status: 'self-guided',
    lineage: { workbookId: 'wb', precedents: [], governanceDomains: [] },
    governanceRatificationCommitted: false,
  },
  onboardingRoles: [],
  recognitionPhaseExitMet: false,
  readinessSufficient: false,
  historicalTenureRecognised: false,
  modernizationScopeNamed: false,
};

const populated: StabilizationWorkflowEngineInput = {
  status: 'facilitated',
  stabilization: {
    densityIndex: 0.7,
    unsuccessedInstitutionCriticalCount: 2,
    unsuccessedLoadBearingCount: 1,
    undocumentedProcessCount: 4,
    singleCarrierProcessCount: 4,
    governanceDriftAggregate: 0.6,
    onboardingCriticalCount: 2,
    breakpointCriticalCount: 2,
  },
  redistribution: {
    status: 'facilitated',
    redistribution: {
      carriers: [
        { id: 'c1', label: 'C1', exposure: 0.85 },
        { id: 'c2', label: 'C2', exposure: 0.5 },
      ],
      processes: [
        { id: 'p1', label: 'P1', singleCarrier: true, undocumented: true },
        { id: 'p2', label: 'P2', singleCarrier: true, undocumented: true },
      ],
      lineageGaps: [{ id: 'l1', subject: 'L1', continuity: 'lapsed' }],
    },
    reciprocityTermsRatified: true,
  },
  recovery: {
    status: 'facilitated',
    lineage: {
      workbookId: 'wb',
      precedents: [
        {
          id: 'pr1',
          subject: 'Founding compensation precedent',
          era: 'founding',
          reaffirmationCount: 0,
          referencedInPractice: false,
          successorBriefed: false,
        },
        {
          id: 'pr2',
          subject: 'Recent bargaining mandate',
          era: 'recent',
          reaffirmationCount: 2,
          referencedInPractice: true,
          successorBriefed: true,
        },
      ],
      governanceDomains: [
        {
          id: 'g1',
          label: 'Compensation governance',
          hasWrittenDesign: true,
          practiceObservedConsistently: false,
          designPracticeDrift: 0.5,
        },
      ],
    },
    governanceRatificationCommitted: true,
  },
  onboardingRoles: [
    { id: 'r1', label: 'r1', daysToCompetency: 300, hasWrittenOnboarding: false, shadowingFeasible: false },
    { id: 'r2', label: 'r2', daysToCompetency: 200, hasWrittenOnboarding: false, shadowingFeasible: true },
  ],
  recognitionPhaseExitMet: true,
  readinessSufficient: true,
  historicalTenureRecognised: true,
  modernizationScopeNamed: false,
};

function corpus(result: ReturnType<typeof runStabilizationWorkflowEngine>): string {
  return [
    result.preview,
    ...result.signals.map((s) => s.statement),
    result.composedReadings.redistribution.preview,
    result.composedReadings.recovery.preview,
    result.composedReadings.onboarding.reading,
  ]
    .join(' ')
    .replace(/anti-surveillance/g, '');
}

describe('stabilizationWorkflowEngine', () => {
  it('exposes engine version 2.0.0', () => {
    expect(ENGINE_VERSION).toBe('2.0.0');
  });

  it('returns no offered workflows on empty input', () => {
    const out = runStabilizationWorkflowEngine(empty);
    expect(out.sequencing.offered).toEqual([]);
    expect(out.sequencing.deferred).toEqual([]);
  });

  it('defers all eligible workflows when recognition phase exit is not met', () => {
    const out = runStabilizationWorkflowEngine({
      ...populated,
      recognitionPhaseExitMet: false,
    });
    expect(out.sequencing.offered).toEqual([]);
    expect(out.sequencing.deferred.length).toBeGreaterThan(0);
    expect(out.sequencing.deferred.every((d) => d.reasons.includes('recognition_phase_exit_not_met'))).toBe(true);
  });

  it('defers stewardship_redistribution when reciprocity terms are not ratified', () => {
    const out = runStabilizationWorkflowEngine({
      ...populated,
      redistribution: { ...populated.redistribution, reciprocityTermsRatified: false },
    });
    const deferred = out.sequencing.deferred.find((d) => d.key === 'stewardship_redistribution');
    expect(deferred).toBeDefined();
    expect(deferred?.reasons).toContain('reciprocity_terms_not_ratified');
  });

  it('offers a sequenced workflow set when conditions are met', () => {
    const out = runStabilizationWorkflowEngine(populated);
    expect(out.sequencing.offered.length).toBeGreaterThan(0);
    expect(out.sequencing.offered[0].position).toBe(1);
    // Reduction precedes addition: capture or redistribution should come
    // before modernization (modernization is not enabled here anyway).
    const keys = out.sequencing.offered.map((o) => o.key);
    expect(keys).toContain('continuity_capture');
    expect(keys).toContain('stewardship_redistribution');
  });

  it('is deterministic', () => {
    const a = runStabilizationWorkflowEngine(populated);
    const b = runStabilizationWorkflowEngine(populated);
    expect(a).toEqual(b);
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const out = runStabilizationWorkflowEngine(populated);
    const text = corpus(out);
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });

  it('escalates severity ordering: institutional_fragility precedes critical', () => {
    // Monopoly carrier (exposure >= 0.9) yields institutional_fragility for redistribution.
    const out = runStabilizationWorkflowEngine({
      ...populated,
      redistribution: {
        ...populated.redistribution,
        redistribution: {
          ...populated.redistribution.redistribution,
          carriers: [{ id: 'c1', label: 'C1', exposure: 0.95 }],
        },
      },
    });
    const offered = out.sequencing.offered;
    const redistributeIdx = offered.findIndex((o) => o.key === 'stewardship_redistribution');
    expect(redistributeIdx).toBeGreaterThanOrEqual(0);
    expect(offered[redistributeIdx].severityBand).toBe('institutional_fragility');
    // It should be at or near the top.
    expect(offered[redistributeIdx].position).toBeLessThanOrEqual(2);
  });
});
