import { describe, expect, it } from 'vitest';
import {
  runModernizationAlignment,
  ENGINE_VERSION,
  type ModernizationAlignmentInput,
} from '@/lib/workbook/engines/modernizationAlignmentEngine';

const FORBIDDEN =
  /\b(transform|optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

// Note: 'transformation' tokens cannot appear in module engines, but the
// modernization engine narrates initiatives — the forbidden check above
// omits the bare 'transformation' alias because the engine doesn't use
// it. We still ban 'transform'.

const empty: ModernizationAlignmentInput = {
  workbookId: 'wb',
  initiatives: [],
  governanceReview: [],
  traceability: [],
};

const populated: ModernizationAlignmentInput = {
  workbookId: 'wb',
  initiatives: [
    {
      id: 'i1',
      label: 'Grievance system replacement',
      arc: 'system_replacement',
      carriersConsulted: false,
      lineageCaptureInScope: false,
      successorIdentificationSupported: false,
      displacesExistingPractice: true,
    },
  ],
  governanceReview: [
    {
      initiativeId: 'i1',
      initiativeLabel: 'Grievance system replacement',
      reviewedByGovernance: false,
      reviewedAtAppropriateLevel: false,
      continuityImplicationsAssessed: false,
    },
  ],
  traceability: [
    {
      initiativeId: 'i1',
      initiativeLabel: 'Grievance system replacement',
      priorPracticeDocumented: false,
      priorRationaleCaptured: false,
      migrationRecordsLineage: false,
    },
  ],
};

describe('modernizationAlignmentEngine', () => {
  it('exposes engine version 2.0.0', () => {
    expect(ENGINE_VERSION).toBe('2.0.0');
  });

  it('returns no signals on empty input', () => {
    expect(runModernizationAlignment(empty).signals).toEqual([]);
  });

  it('is deterministic', () => {
    expect(runModernizationAlignment(populated)).toEqual(runModernizationAlignment(populated));
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const out = runModernizationAlignment(populated);
    const text = [out.preview, ...out.signals.map((s) => s.statement)].join(' ').replace(/anti-surveillance/g, '');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });
});
