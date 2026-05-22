import { describe, expect, it } from 'vitest';
import {
  runGovernanceRecovery,
  ENGINE_VERSION,
  type GovernanceRecoveryInput,
} from '@/lib/workbook/engines/governanceRecoveryEngine';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

const empty: GovernanceRecoveryInput = {
  status: 'self-guided',
  lineage: { workbookId: 'wb', precedents: [], governanceDomains: [] },
  governanceRatificationCommitted: false,
};

const lapsedAndDrifted: GovernanceRecoveryInput = {
  status: 'facilitated',
  lineage: {
    workbookId: 'wb',
    precedents: [
      {
        id: 'p1',
        subject: 'Compensation review cadence',
        era: 'founding',
        reaffirmationCount: 0,
        referencedInPractice: false,
        successorBriefed: false,
      },
      {
        id: 'p2',
        subject: 'Bargaining mandate scope',
        era: 'mid_term',
        reaffirmationCount: 0,
        referencedInPractice: false,
        successorBriefed: false,
      },
      {
        id: 'p3',
        subject: 'Grievance process precedent',
        era: 'mid_term',
        reaffirmationCount: 0,
        referencedInPractice: false,
        successorBriefed: false,
      },
    ],
    governanceDomains: [
      {
        id: 'g1',
        label: 'Compensation governance',
        hasWrittenDesign: true,
        practiceObservedConsistently: false,
        designPracticeDrift: 0.8,
      },
      {
        id: 'g2',
        label: 'Bargaining governance',
        hasWrittenDesign: true,
        practiceObservedConsistently: false,
        designPracticeDrift: 0.75,
      },
    ],
  },
  governanceRatificationCommitted: false,
};

const ratified: GovernanceRecoveryInput = {
  ...lapsedAndDrifted,
  governanceRatificationCommitted: true,
};

describe('governanceRecoveryEngine', () => {
  it('exposes engine version 2.0.0', () => {
    expect(ENGINE_VERSION).toBe('2.0.0');
  });

  it('returns the no-lineage-surface honest disposition on empty input', () => {
    const out = runGovernanceRecovery(empty);
    expect(out.signals.length).toBe(1);
    expect(out.signals[0].category).toBe('no_lineage_surface');
    expect(out.signals[0].severity).toBe('note');
  });

  it('flags lapsed precedent recovery as critical at high lapsed count', () => {
    const out = runGovernanceRecovery(lapsedAndDrifted);
    const lapsed = out.signals.find(
      (s) => s.category === 'lapsed_precedent_recovery_required',
    );
    expect(lapsed).toBeDefined();
    expect(lapsed?.severity).toBe('critical');
  });

  it('requires governance ratification when commitment is absent', () => {
    const out = runGovernanceRecovery(lapsedAndDrifted);
    const ratificationSignal = out.signals.find(
      (s) => s.category === 'governance_ratification_pending',
    );
    expect(ratificationSignal).toBeDefined();
    expect(ratificationSignal?.severity).toBe('warning');
  });

  it('omits ratification-pending when commitment is given', () => {
    const out = runGovernanceRecovery(ratified);
    const ratificationSignal = out.signals.find(
      (s) => s.category === 'governance_ratification_pending',
    );
    expect(ratificationSignal).toBeUndefined();
  });

  it('is deterministic', () => {
    expect(runGovernanceRecovery(lapsedAndDrifted)).toEqual(
      runGovernanceRecovery(lapsedAndDrifted),
    );
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const out = runGovernanceRecovery(lapsedAndDrifted);
    const text = [out.preview, ...out.signals.map((s) => s.statement)]
      .join(' ')
      .replace(/anti-surveillance/g, '');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });
});
