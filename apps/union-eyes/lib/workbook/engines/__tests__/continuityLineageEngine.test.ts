import { describe, expect, it } from 'vitest';
import {
  runContinuityLineage,
  ENGINE_VERSION,
  type ContinuityLineageInput,
} from '@/lib/workbook/engines/continuityLineageEngine';

const FORBIDDEN =
  /\b(transformation|transform|optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

const empty: ContinuityLineageInput = { workbookId: 'wb', precedents: [], governanceDomains: [] };

const populated: ContinuityLineageInput = {
  workbookId: 'wb',
  precedents: [
    { id: 'p1', subject: 'Compensation review cadence', era: 'founding', reaffirmationCount: 0, referencedInPractice: false, successorBriefed: false },
    { id: 'p2', subject: 'Bargaining mandate scope', era: 'mid_term', reaffirmationCount: 3, referencedInPractice: true, successorBriefed: true },
  ],
  governanceDomains: [
    { id: 'g1', label: 'Compensation governance', hasWrittenDesign: true, practiceObservedConsistently: false, designPracticeDrift: 0.75 },
    { id: 'g2', label: 'Bargaining governance', hasWrittenDesign: true, practiceObservedConsistently: true, designPracticeDrift: 0.1 },
  ],
};

describe('continuityLineageEngine', () => {
  it('exposes engine version 2.0.0', () => {
    expect(ENGINE_VERSION).toBe('2.0.0');
  });

  it('returns no signals on empty input', () => {
    expect(runContinuityLineage(empty).signals).toEqual([]);
  });

  it('is deterministic', () => {
    expect(runContinuityLineage(populated)).toEqual(runContinuityLineage(populated));
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const out = runContinuityLineage(populated);
    const text = [out.preview, ...out.signals.map((s) => s.statement)].join(' ').replace(/anti-surveillance/g, '');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });
});
