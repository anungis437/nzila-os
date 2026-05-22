import { describe, expect, it } from 'vitest';
import {
  runStewardshipRedistribution,
  ENGINE_VERSION,
  type StewardshipRedistributionInput,
} from '@/lib/workbook/engines/stewardshipRedistributionEngine';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

const empty: StewardshipRedistributionInput = {
  status: 'self-guided',
  redistribution: { carriers: [], processes: [], lineageGaps: [] },
  reciprocityTermsRatified: false,
};

const monopolyAndUndocumented: StewardshipRedistributionInput = {
  status: 'facilitated',
  redistribution: {
    carriers: [
      { id: 'c1', label: 'Bargaining lead', exposure: 0.95 },
      { id: 'c2', label: 'Grievance lead', exposure: 0.85 },
    ],
    processes: [
      { id: 'p1', label: 'Member intake', singleCarrier: true, undocumented: true },
      { id: 'p2', label: 'Case escalation', singleCarrier: true, undocumented: true },
      { id: 'p3', label: 'Hearing preparation', singleCarrier: true, undocumented: true },
    ],
    lineageGaps: [
      { id: 'l1', subject: 'Mandate scope precedent', continuity: 'lapsed' },
    ],
  },
  reciprocityTermsRatified: false,
};

const reciprocityRatified: StewardshipRedistributionInput = {
  ...monopolyAndUndocumented,
  reciprocityTermsRatified: true,
};

describe('stewardshipRedistributionEngine', () => {
  it('exposes engine version 2.0.0', () => {
    expect(ENGINE_VERSION).toBe('2.0.0');
  });

  it('returns the no-targets honest disposition on empty input', () => {
    const out = runStewardshipRedistribution(empty);
    expect(out.plan.targets).toEqual([]);
    expect(out.signals.length).toBe(1);
    expect(out.signals[0].category).toBe('no_redistribution_targets');
    expect(out.signals[0].severity).toBe('note');
  });

  it('flags monopoly concentration at critical when exposure exceeds the critical threshold', () => {
    const out = runStewardshipRedistribution(monopolyAndUndocumented);
    const monopoly = out.signals.find((s) => s.category === 'monopoly_concentration');
    expect(monopoly).toBeDefined();
    expect(monopoly?.severity).toBe('critical');
  });

  it('requires reciprocity terms when targets are present without ratification', () => {
    const out = runStewardshipRedistribution(monopolyAndUndocumented);
    const reciprocity = out.signals.find(
      (s) => s.category === 'reciprocity_terms_required',
    );
    expect(reciprocity).toBeDefined();
    expect(reciprocity?.severity).toBe('warning');
    const ready = out.signals.find((s) => s.category === 'broadening_ready');
    expect(ready).toBeUndefined();
  });

  it('emits broadening-ready when reciprocity is ratified', () => {
    const out = runStewardshipRedistribution(reciprocityRatified);
    const ready = out.signals.find((s) => s.category === 'broadening_ready');
    expect(ready).toBeDefined();
    expect(ready?.severity).toBe('note');
    const reciprocity = out.signals.find(
      (s) => s.category === 'reciprocity_terms_required',
    );
    expect(reciprocity).toBeUndefined();
  });

  it('is deterministic', () => {
    expect(runStewardshipRedistribution(monopolyAndUndocumented)).toEqual(
      runStewardshipRedistribution(monopolyAndUndocumented),
    );
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const out = runStewardshipRedistribution(monopolyAndUndocumented);
    const text = [
      out.preview,
      ...out.signals.map((s) => s.statement),
      ...out.plan.targets.map((t) => t.rationale),
    ]
      .join(' ')
      .replace(/anti-surveillance/g, '');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });
});
