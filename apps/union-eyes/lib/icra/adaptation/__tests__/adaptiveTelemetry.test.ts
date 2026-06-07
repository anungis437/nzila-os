/**
 * Adaptive telemetry tests.
 *
 * Asserts:
 *  - Each emit helper calls fireAndForgetEvent with the right kind.
 *  - Metadata contains only enum tokens / counts / booleans / short ids.
 *  - No PII fields are ever emitted (no email, no UUID, no free text).
 *  - The deferred-question batch emitter only fires for `defer_*` decisions.
 *  - The route whitelist includes the three new adaptive kinds.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fireMock } = vi.hoisted(() => ({ fireMock: vi.fn() }));
vi.mock('@/lib/icra/observability', async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    fireAndForgetEvent: fireMock,
  };
});

import {
  emitAdaptiveProfileCreated,
  emitAdaptiveQuestionDeferred,
  emitAssessmentRouted,
  emitDeferredQuestionsForRoutedBank,
} from '../adaptiveTelemetry';
import { classifyOrgContext } from '../orgContextClassifier';
import { routeQuestionBank } from '../questionRoutingEngine';
import type { RoutableQuestion, RoutingRationale } from '../routingTypes';

beforeEach(() => {
  fireMock.mockReset();
});

function flatten(obj: any): string {
  return JSON.stringify(obj);
}
function pii(s: string): boolean {
  return /@|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(s);
}

const PROFILE = classifyOrgContext({
  rawForm: {
    ctx_org_type: 'national_union',
    ctx_sector: 'labour_union',
    ctx_membership_size: '500_to_4999',
    ctx_years_operating: '15_to_29_years',
    ctx_respondent_role: 'self_senior_leader',
  },
});

describe('emitAdaptiveProfileCreated', () => {
  it('fires exactly one adaptive_profile_created event', () => {
    emitAdaptiveProfileCreated(PROFILE);
    expect(fireMock).toHaveBeenCalledTimes(1);
    const call = fireMock.mock.calls[0][0];
    expect(call.kind).toBe('adaptive_profile_created');
  });

  it('metadata is enum-only and PII-free', () => {
    emitAdaptiveProfileCreated(PROFILE);
    const md = fireMock.mock.calls[0][0].metadata;
    expect(md.doctrineVersion).toBe('1.0.0');
    expect(md.scale).toBe(PROFILE.institutionalScale);
    expect(md.lens).toBe(PROFILE.respondentLens);
    expect(typeof md.safeDefault).toBe('boolean');
    expect(pii(flatten(md))).toBe(false);
  });
});

describe('emitAssessmentRouted', () => {
  const bank: RoutableQuestion[] = Array.from({ length: 20 }, (_, i) => ({
    id: `q${i + 1}`,
    section: 's1',
    order: i,
  }));

  it('fires exactly one assessment_routed event', () => {
    const routed = routeQuestionBank(bank, PROFILE);
    emitAssessmentRouted(routed);
    expect(fireMock).toHaveBeenCalledTimes(1);
    const call = fireMock.mock.calls[0][0];
    expect(call.kind).toBe('assessment_routed');
  });

  it('metadata carries counts + flags + truncated selection token', () => {
    const routed = routeQuestionBank(bank, PROFILE);
    emitAssessmentRouted(routed);
    const md = fireMock.mock.calls[0][0].metadata;
    expect(typeof md.included).toBe('number');
    expect(typeof md.deferred).toBe('number');
    expect(typeof md.safeDefault).toBe('boolean');
    expect(typeof md.selection).toBe('string');
    expect((md.selection as string).length).toBeLessThanOrEqual(60);
    expect(pii(flatten(md))).toBe(false);
  });
});

describe('emitAdaptiveQuestionDeferred', () => {
  it('fires once for a defer_* rationale', () => {
    const r: RoutingRationale = {
      questionId: 'q42',
      decision: 'defer_suppressed',
      ruleId: 'eligibility.suppressed_for_scale',
      statement: 'Suppressed for small scale.',
    };
    emitAdaptiveQuestionDeferred(r);
    expect(fireMock).toHaveBeenCalledTimes(1);
    expect(fireMock.mock.calls[0][0].kind).toBe('adaptive_question_deferred');
    const md = fireMock.mock.calls[0][0].metadata;
    expect(md.questionId).toBe('q42');
    expect(md.decision).toBe('defer_suppressed');
    expect(pii(flatten(md))).toBe(false);
  });

  it('does NOT fire for include_* rationale', () => {
    const r: RoutingRationale = {
      questionId: 'q1',
      decision: 'include_core',
      ruleId: 'eligibility.no_metadata',
      statement: 'Core question, no metadata.',
    };
    emitAdaptiveQuestionDeferred(r);
    expect(fireMock).not.toHaveBeenCalled();
  });
});

describe('emitDeferredQuestionsForRoutedBank', () => {
  it('emits one event per defer_* rationale, zero for include_*', () => {
    const routed = {
      doctrineVersion: '1.0.0' as const,
      routeVersion: '1.0.0' as const,
      includedQuestions: [],
      deferredQuestions: [],
      requiredQuestions: [],
      optionalContextQuestions: [],
      routingRationale: [
        {
          questionId: 'q1',
          decision: 'include_core' as const,
          ruleId: 'r.a',
          statement: '',
        },
        {
          questionId: 'q2',
          decision: 'defer_suppressed' as const,
          ruleId: 'r.b',
          statement: '',
        },
        {
          questionId: 'q3',
          decision: 'defer_complexity_floor' as const,
          ruleId: 'r.c',
          statement: '',
        },
        {
          questionId: 'q4',
          decision: 'include_recommended' as const,
          ruleId: 'r.d',
          statement: '',
        },
      ],
      usedSafeDefault: false,
      selectionFingerprint: 'fp',
    };
    emitDeferredQuestionsForRoutedBank(routed);
    expect(fireMock).toHaveBeenCalledTimes(2);
    expect(fireMock.mock.calls.every((c) => c[0].kind === 'adaptive_question_deferred')).toBe(true);
  });
});

describe('telemetry route ALLOWED_KINDS', () => {
  it('whitelists the three new adaptive kinds', async () => {
    // Re-read the route source to assert whitelist text content. This is a
    // documentation-level guard so the whitelist cannot drift away from the
    // event kind enum without a failing test.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    // Resolve relative to this test file so the test works whether vitest
    // is invoked from the repo root or from the package directory.
    const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
    const file = path.resolve(here, '../../../../app/api/icra/telemetry/route.ts');
    const src = await fs.readFile(file, 'utf8');
    expect(src).toMatch(/'adaptive_profile_created'/);
    expect(src).toMatch(/'assessment_routed'/);
    expect(src).toMatch(/'adaptive_question_deferred'/);
  });
});
