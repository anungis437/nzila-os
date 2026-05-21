import { describe, expect, it } from 'vitest';
import {
  runTransformationRoadmap,
  ENGINE_VERSION,
  type TransformationRoadmapInput,
} from '@/lib/workbook/engines/transformationRoadmapEngine';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
// Note: the engine's own filename uses "transformation" doctrinally —
// we ban consulting-vocabulary variants but allow the OCI term.
const BLAME = /why do you (not|fail to|never)/i;

const empty: TransformationRoadmapInput = {
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
  redistribution: { carriers: [], processes: [], lineageGaps: [] },
  maturity: {
    densityIndex: 0,
    workbookCompleted: false,
    stabilizationRatified: false,
    continuityEmbedded: false,
    longitudinalIntelligenceConsumed: false,
  },
};

const populated: TransformationRoadmapInput = {
  status: 'facilitated',
  stabilization: {
    densityIndex: 0.7,
    unsuccessedInstitutionCriticalCount: 2,
    unsuccessedLoadBearingCount: 1,
    undocumentedProcessCount: 4,
    singleCarrierProcessCount: 4,
    governanceDriftAggregate: 0.6,
    onboardingCriticalCount: 1,
    breakpointCriticalCount: 2,
  },
  redistribution: {
    carriers: [{ id: 'c1', label: 'C1', exposure: 0.8 }],
    processes: [{ id: 'p1', label: 'P1', singleCarrier: true, undocumented: true }],
    lineageGaps: [{ id: 'l1', subject: 'L1', continuity: 'lapsed' }],
  },
  maturity: {
    densityIndex: 0.7,
    workbookCompleted: true,
    stabilizationRatified: false,
    continuityEmbedded: false,
    longitudinalIntelligenceConsumed: false,
  },
};

describe('transformationRoadmapEngine', () => {
  it('exposes engine version 2.0.0', () => {
    expect(ENGINE_VERSION).toBe('2.0.0');
  });

  it('returns minimal output on empty input', () => {
    const out = runTransformationRoadmap(empty);
    expect(out.stabilization).toEqual([]);
    expect(out.redistribution.targets).toEqual([]);
    expect(out.pathway.currentStage).toBe('recognition_only');
  });

  it('is deterministic', () => {
    expect(runTransformationRoadmap(populated)).toEqual(runTransformationRoadmap(populated));
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const out = runTransformationRoadmap(populated);
    const text = [out.preview, ...out.signals.map((s) => s.statement), ...out.stabilization.map((m) => m.summary), ...out.redistribution.targets.map((t) => t.rationale), out.pathway.reading].join(' ').replace(/anti-surveillance/g, '');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });

  it('sequences stabilization moves with at least one priority-1', () => {
    const out = runTransformationRoadmap(populated);
    expect(out.stabilization.length).toBeGreaterThan(0);
    expect(out.stabilization[0].priority).toBe(1);
  });
});
