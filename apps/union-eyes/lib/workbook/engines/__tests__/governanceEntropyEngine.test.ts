import { describe, expect, it } from 'vitest';
import {
  runGovernanceEntropy,
  ENGINE_VERSION,
} from '@/lib/workbook/engines/governanceEntropyEngine';

const FORBIDDEN =
  /\b(transformation|transform|optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

describe('governanceEntropyEngine', () => {
  it('exposes engine version 2.0.0', () => {
    expect(ENGINE_VERSION).toBe('2.0.0');
  });

  it('classifies zero drift as the lowest entropy band', () => {
    const out = runGovernanceEntropy({ workbookId: 'wb', driftEstimate: 0 });
    expect(out.aggregateDrift).toBe(0);
    expect(out.attribution).toEqual([]);
  });

  it('is deterministic', () => {
    const input = { workbookId: 'wb', driftEstimate: 0.5 };
    expect(runGovernanceEntropy(input)).toEqual(runGovernanceEntropy(input));
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const out = runGovernanceEntropy({ workbookId: 'wb', driftEstimate: 0.7 });
    const text = out.reading.replace(/anti-surveillance/g, '');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });
});
