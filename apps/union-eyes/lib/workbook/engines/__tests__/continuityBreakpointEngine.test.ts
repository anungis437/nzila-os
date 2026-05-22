import { describe, expect, it } from 'vitest';
import {
  runContinuityBreakpoint,
  ENGINE_VERSION,
  type ContinuityBreakpointInput,
} from '@/lib/workbook/engines/continuityBreakpointEngine';

const FORBIDDEN =
  /\b(transformation|transform|optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

const empty: ContinuityBreakpointInput = { workbookId: 'wb', breakpoints: [], onboardingRoles: [] };

const populated: ContinuityBreakpointInput = {
  workbookId: 'wb',
  breakpoints: [
    {
      id: 'bp1',
      subject: 'Grievance intake',
      dependency: 'single_carrier',
      successor: 'unidentified',
      reconstruction: {
        exposedCarriers: 1,
        institutionCriticalCarriers: 1,
        densityIndex: 0.8,
        governanceEntropyOrdinal: 4,
      },
    },
  ],
  onboardingRoles: [
    { id: 'role_A', label: 'Steward', daysToCompetency: 540, hasWrittenOnboarding: false, shadowingFeasible: false },
  ],
};

describe('continuityBreakpointEngine', () => {
  it('exposes engine version 2.0.0', () => {
    expect(ENGINE_VERSION).toBe('2.0.0');
  });

  it('returns no signals on empty input', () => {
    expect(runContinuityBreakpoint(empty).signals).toEqual([]);
  });

  it('is deterministic', () => {
    expect(runContinuityBreakpoint(populated)).toEqual(runContinuityBreakpoint(populated));
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const out = runContinuityBreakpoint(populated);
    const text = [out.preview, ...out.signals.map((s) => s.statement)].join(' ').replace(/anti-surveillance/g, '');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });
});
