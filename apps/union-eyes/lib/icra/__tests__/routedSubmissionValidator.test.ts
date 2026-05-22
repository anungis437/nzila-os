/**
 * ARTIFACT TYPE: Vitest Suite — Routed Submission Integrity
 * MODULE: OCRA Adaptive — Submit path validator
 * DOCTRINE_VERSION: 1.0.0
 *
 * Locks down the two integrity guarantees of `validateRoutedSubmission`:
 *
 *   1. Missing answers for INCLUDED REQUIRED questions are reported.
 *   2. Stray answers for DEFERRED questions are reported.
 *
 * HARD RULE: the validator never invents or coerces answers. It only
 * reports. These tests will fail if anyone tries to relax that rule.
 */

import { describe, expect, it } from 'vitest';

import {
  validateRoutedSubmission,
  type RoutableQuestion,
  type RoutedQuestionBank,
} from '../adaptation';

function bank(
  included: readonly RoutableQuestion[],
  deferred: readonly RoutableQuestion[],
  required: readonly RoutableQuestion[],
): RoutedQuestionBank {
  return {
    doctrineVersion: '1.0.0',
    routeVersion: '1.0.0',
    includedQuestions: included,
    deferredQuestions: deferred,
    requiredQuestions: required,
    optionalContextQuestions: [],
    routingRationale: [],
    usedSafeDefault: false,
    selectionFingerprint: 'test-fp',
  };
}

const q = (id: string, section = 's1', order = 1): RoutableQuestion => ({
  id,
  section,
  order,
});

describe('validateRoutedSubmission', () => {
  it('returns ok when every included required question is answered and no deferred answers are present', () => {
    const r = bank(
      [q('a'), q('b'), q('c')],
      [q('d')],
      [q('a'), q('b')],
    );
    const result = validateRoutedSubmission(r, ['a', 'b', 'c']);
    expect(result).toEqual({
      ok: true,
      missingRequiredIds: [],
      strayDeferredAnswerIds: [],
    });
  });

  it('reports missing required answers when an included required question is not answered', () => {
    const r = bank([q('a'), q('b')], [], [q('a'), q('b')]);
    const result = validateRoutedSubmission(r, ['a']);
    expect(result.ok).toBe(false);
    expect(result.missingRequiredIds).toEqual(['b']);
    expect(result.strayDeferredAnswerIds).toEqual([]);
  });

  it('does NOT report missing for required questions that were routed out (deferred)', () => {
    // 'b' is required globally but deferred for this profile → not asked
    const r = bank([q('a')], [q('b')], [q('a'), q('b')]);
    const result = validateRoutedSubmission(r, ['a']);
    expect(result.ok).toBe(true);
    expect(result.missingRequiredIds).toEqual([]);
  });

  it('reports stray answers when respondent answers a deferred question', () => {
    const r = bank([q('a')], [q('b'), q('c')], [q('a')]);
    const result = validateRoutedSubmission(r, ['a', 'c']);
    expect(result.ok).toBe(false);
    expect(result.strayDeferredAnswerIds).toEqual(['c']);
  });

  it('reports both missing and stray simultaneously', () => {
    const r = bank([q('a'), q('b')], [q('z')], [q('a'), q('b')]);
    const result = validateRoutedSubmission(r, ['a', 'z']);
    expect(result.ok).toBe(false);
    expect(result.missingRequiredIds).toEqual(['b']);
    expect(result.strayDeferredAnswerIds).toEqual(['z']);
  });

  it('never returns synthesized answer values — pure reporting only', () => {
    const r = bank([q('a')], [], [q('a')]);
    const result = validateRoutedSubmission(r, []);
    // Result must not contain any answer-shaped fields. Only id lists.
    expect(Object.keys(result).sort()).toEqual(
      ['missingRequiredIds', 'ok', 'strayDeferredAnswerIds'],
    );
  });
});
