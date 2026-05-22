import { describe, expect, it } from 'vitest';
import {
  runWorkbookSynthesis,
  ENGINE_VERSION,
  type WorkbookSynthesisInput,
} from '@/lib/workbook/engines/workbookSynthesisEngine';

const FORBIDDEN =
  /\b(transform|optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

const empty: WorkbookSynthesisInput = {
  status: 'self-guided',
  aggregates: {
    densityIndex: 0,
    onboardingCriticalCount: 0,
    breakpointCriticalCount: 0,
    modernizationErodingCount: 0,
    lineageLapsedOrFadingCount: 0,
    governanceDriftAggregate: 0,
    reconstructionBurdenMean: 0,
    mappingComplete: false,
    stabilizationRatified: false,
    governanceReviewPresent: false,
    landscapePosture: 'distributed',
  },
  profileInput: {
    densityIndex: 0,
    governanceDriftAggregate: 0,
    breakpointCriticalCount: 0,
    modernizationErodingCount: 0,
    lineageLapsedOrFadingCount: 0,
    stabilizationCandidateCount: 0,
  },
};

const populated: WorkbookSynthesisInput = {
  status: 'facilitated',
  aggregates: {
    densityIndex: 0.7,
    onboardingCriticalCount: 2,
    breakpointCriticalCount: 3,
    modernizationErodingCount: 2,
    lineageLapsedOrFadingCount: 3,
    governanceDriftAggregate: 0.6,
    reconstructionBurdenMean: 0.6,
    mappingComplete: true,
    stabilizationRatified: true,
    governanceReviewPresent: false,
    landscapePosture: 'concentrated',
  },
  profileInput: {
    densityIndex: 0.7,
    governanceDriftAggregate: 0.6,
    breakpointCriticalCount: 3,
    modernizationErodingCount: 2,
    lineageLapsedOrFadingCount: 3,
    stabilizationCandidateCount: 6,
  },
};

describe('workbookSynthesisEngine', () => {
  it('exposes engine version 2.0.0', () => {
    expect(ENGINE_VERSION).toBe('2.0.0');
  });

  it('returns stable posture on empty input', () => {
    const out = runWorkbookSynthesis(empty);
    expect(out.crossModuleSignals).toEqual([]);
    expect(out.profile.posture).toBe('continuity_stable');
  });

  it('is deterministic', () => {
    expect(runWorkbookSynthesis(populated)).toEqual(runWorkbookSynthesis(populated));
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const out = runWorkbookSynthesis(populated);
    const text = [out.preview, out.profile.reading, ...out.crossModuleSignals.map((s) => s.statement)].join(' ').replace(/anti-surveillance/g, '');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });

  it('surfaces multiple cross-module signals when aggregates are compound', () => {
    const out = runWorkbookSynthesis(populated);
    expect(out.crossModuleSignals.length).toBeGreaterThanOrEqual(2);
  });
});
